// Dispatch switches (design SS5-2). Pure: the reader is injected so the tests
// can prove "read failure = closed" without a database.
//
// Every read here is FRESH (no cache) -- the recheck right before POST /posts
// must see what an operator just flipped, not a cached value.
//
// FAIL-CLOSED: a missing row, a read error, a thrown exception, or any value
// other than the literal 'true' = closed. 'unreadable' is kept distinct from
// 'closed' only so callers can report it differently (503 dispatch_unreadable
// vs dispatch_disabled); both mean "do not send".
import { DBAS, MASTER_DISPATCH_KEY, dispatchSwitchKey, type Dba } from '@/lib/content-kinds'

export type ConfigReader = (keys: readonly string[]) => Promise<Map<string, string> | null>

export const isSwitchOn = (value: string | null | undefined): boolean => value === 'true'

export type MasterState = 'open' | 'closed' | 'unreadable'

export async function readMasterSwitch(read: ConfigReader): Promise<MasterState> {
  try {
    const cfg = await read([MASTER_DISPATCH_KEY])
    if (!cfg) return 'unreadable'
    return isSwitchOn(cfg.get(MASTER_DISPATCH_KEY)) ? 'open' : 'closed'
  } catch {
    return 'unreadable'
  }
}

export type DispatchState =
  | { state: 'unreadable' }
  | { state: 'master_closed' }
  | { state: 'ok'; openDbas: Dba[]; config: Map<string, string> }

// Master + every DBA switch + any extra keys the caller needs, in ONE read so
// the decision and the values it used cannot come from different moments.
export async function readDispatchState(read: ConfigReader, extraKeys: readonly string[] = []): Promise<DispatchState> {
  try {
    const cfg = await read([MASTER_DISPATCH_KEY, ...DBAS.map(dispatchSwitchKey), ...extraKeys])
    if (!cfg) return { state: 'unreadable' }
    if (!isSwitchOn(cfg.get(MASTER_DISPATCH_KEY))) return { state: 'master_closed' }
    const openDbas = DBAS.filter((d) => isSwitchOn(cfg.get(dispatchSwitchKey(d))))
    return { state: 'ok', openDbas, config: cfg }
  } catch {
    return { state: 'unreadable' }
  }
}
