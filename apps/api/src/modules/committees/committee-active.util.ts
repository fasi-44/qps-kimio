import { ForbiddenException } from '@nestjs/common';
import { CommitteeStatus } from '@nabh/shared';

/**
 * Guard for committee-scoped writes: once a committee is INACTIVE or ARCHIVED,
 * no create / update / delete operations are permitted anywhere under it.
 *
 * Pure check — pass the status already loaded by the caller's existing query
 * (e.g. a `committee: { select: { status: true } }` join) so this adds no extra DB call.
 * Reads remain allowed; changing the committee's own status is exempt (so it can be re-activated).
 */
export function assertCommitteeActive(status: string): void {
  if (status !== CommitteeStatus.ACTIVE) {
    throw new ForbiddenException(
      `This committee is ${status.toLowerCase()} — create, update and delete operations are not allowed`,
    );
  }
}
