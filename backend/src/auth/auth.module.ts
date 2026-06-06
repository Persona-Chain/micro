import { Module } from '@nestjs/common'
import { PassportModule } from '@nestjs/passport'
import { AuthService } from './auth.service'
import { AuthController } from './auth.controller'
import { PrismaModule } from '../prisma/prisma.module'
import { MailService } from '../mail/mail.service'
import { JwtGuard } from './jwt.guard'
import { GoogleStrategy } from './google.strategy'

@Module({
  imports: [PrismaModule, PassportModule.register({ defaultStrategy: 'jwt' })],
  providers: [AuthService, MailService, JwtGuard, GoogleStrategy],
  controllers: [AuthController],
})
export class AuthModule {}
