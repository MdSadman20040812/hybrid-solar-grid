import type { PendingCommand, ZoneKey } from '../../../shared/protocol.js';

interface PendingRecord extends PendingCommand {
  timer: NodeJS.Timeout;
}

export class CommandService {
  private readonly pending = new Map<string, PendingRecord>();

  constructor(private readonly timeoutMs: number) {}

  create(
    command: Omit<PendingCommand, 'requestedAt'> & { requestedAt?: number },
    onTimeout: (command: PendingCommand) => void
  ): PendingCommand {
    const pending: PendingCommand = {
      commandId: command.commandId,
      zone: command.zone,
      desiredState: command.desiredState,
      requestedAt: command.requestedAt ?? Date.now()
    };
    const timer = setTimeout(() => {
      this.pending.delete(pending.commandId);
      onTimeout(pending);
    }, this.timeoutMs);
    timer.unref?.();
    this.pending.set(pending.commandId, { ...pending, timer });
    return pending;
  }

  resolve(commandId: string): PendingCommand | null {
    const record = this.pending.get(commandId);
    if (!record) return null;
    clearTimeout(record.timer);
    this.pending.delete(commandId);
    return {
      commandId: record.commandId,
      zone: record.zone,
      desiredState: record.desiredState,
      requestedAt: record.requestedAt
    };
  }

  hasPendingZone(zone: ZoneKey): boolean {
    return [...this.pending.values()].some((record) => record.zone === zone);
  }

  getPending(): PendingCommand[] {
    return [...this.pending.values()].map(({ timer: _timer, ...record }) => ({ ...record }));
  }

  clear(): void {
    for (const record of this.pending.values()) clearTimeout(record.timer);
    this.pending.clear();
  }
}
