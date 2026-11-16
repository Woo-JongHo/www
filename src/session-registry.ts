/**
 * @architecture arch.native.lifecycle
 * @implements RESP-NATIVE-LIFECYCLE
 */
export function createSessionRegistry<T extends { id: string }>() {
  const sessions = new Map<string, T>();
  const owners = new Map<string, string>();
  const owned = new Map<string, string>();
  const pending = new Map<string, { key: string }>();
  const pendingOwners = new Map<string, string>();
  let defaultId: string | undefined;

  function get(id = defaultId): T {
    const session = id === undefined ? undefined : sessions.get(id);
    if (!session) throw new Error("세션을 찾을 수 없습니다.");
    return session;
  }

  function release(id: string): void {
    const previous = owned.get(id);
    if (previous !== undefined) owners.delete(previous);
    owned.delete(id);
    const reservation = pending.get(id);
    if (reservation) pendingOwners.delete(reservation.key);
    pending.delete(id);
  }

  return {
    add(session: T): void {
      if (sessions.has(session.id)) throw new Error("이미 등록된 세션입니다.");
      sessions.set(session.id, session);
      defaultId ??= session.id;
    },
    get,
    list(): T[] { return [...sessions.values()]; },
    remove(id: string): void {
      get(id);
      release(id);
      sessions.delete(id);
      if (defaultId === id) defaultId = sessions.keys().next().value;
    },
    release,
    reserve(id: string, workspaceKey: string, threadId: string) {
      get(id);
      if (pending.has(id)) throw new Error("이 세션에서 이미 대화를 열고 있습니다.");
      const key = JSON.stringify([workspaceKey, threadId]);
      const owner = owners.get(key);
      const pendingOwner = pendingOwners.get(key);
      if ((owner !== undefined && owner !== id) || (pendingOwner !== undefined && pendingOwner !== id)) {
        throw new Error("이 대화는 다른 탭에서 열려 있습니다. 해당 탭을 이용해 주세요.");
      }
      const reservation = { key };
      pending.set(id, reservation);
      pendingOwners.set(key, id);
      return {
        commit(): void {
          if (pending.get(id) !== reservation) throw new Error("유효하지 않은 대화 예약입니다.");
          const previous = owned.get(id);
          if (previous !== undefined) owners.delete(previous);
          owners.set(key, id);
          owned.set(id, key);
          pending.delete(id);
          pendingOwners.delete(key);
        },
        rollback(): void {
          if (pending.get(id) !== reservation) return;
          pending.delete(id);
          pendingOwners.delete(key);
        }
      };
    }
  };
}
