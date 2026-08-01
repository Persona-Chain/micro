import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common'
import { verify, Secret } from 'jsonwebtoken'
import { getJwtSecret } from './jwt-secret'

@Injectable()
export class JwtGuard implements CanActivate {
  canActivate(context: ExecutionContext) {
    const req = context.switchToHttp().getRequest()
    const auth = req.headers['authorization'] || ''
    const parts = auth.split(' ')
    if (parts.length !== 2 || parts[0] !== 'Bearer') throw new UnauthorizedException()
    const token = parts[1]
    try {
      const secret: Secret = getJwtSecret()
      const payload = verify(token, secret) as any
      if (payload.type !== 'access') throw new UnauthorizedException()
      req.user = { id: payload.sub }
      return true
    } catch (err) {
      throw new UnauthorizedException()
    }
  }
}
