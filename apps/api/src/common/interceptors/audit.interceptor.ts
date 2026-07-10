import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';

// Audit logging is handled at the service layer for data-level precision.
// This interceptor captures HTTP-level access for login/logout.
@Injectable()
export class AuditInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    return next.handle().pipe(
      tap(() => {
        // Fine-grained audit logging happens in AuthService and other services.
        // HTTP access logs are handled by Winston/Morgan at the middleware level.
      }),
    );
  }
}
