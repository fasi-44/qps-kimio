import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { JwtPayload } from '@nabh/shared';

export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): JwtPayload => {
    const request = ctx.switchToHttp().getRequest();
    return request.user;
  },
);
