import { Body, Controller, Get, Post, Req, UseGuards } from '@nestjs/common'
import { AuthGuard } from '@nestjs/passport'
import { AuthService } from './auth.service'
import { RegisterDto } from './dto/register.dto'
import { LoginDto } from './dto/login.dto'
import { RefreshDto } from './dto/refresh.dto'
import { ForgotPasswordDto } from './dto/forgot-password.dto'
import { ResetPasswordDto } from './dto/reset-password.dto'
import { VerifyEmailDto } from './dto/verify-email.dto'
import { ChangePasswordDto } from './dto/change-password.dto'
import { TwoFactorVerifyDto } from './dto/twofactor-verify.dto'
import { JwtGuard } from './jwt.guard'
import { User } from './decorators/user.decorator'

@Controller('auth')
export class AuthController {
  constructor(private authService: AuthService) {}

  @Post('register')
  async register(@Body() body: RegisterDto) {
    return this.authService.register(body.email, body.username, body.password)
  }

  @Post('login')
  async login(@Body() body: LoginDto, @Req() req: any) {
    const ip = req.ip || req.headers['x-forwarded-for'] || null
    return this.authService.login(body.email, body.password, body.userAgent || req.headers['user-agent'], ip)
  }

  @Post('logout')
  async logout(@Body() body: { sessionId: string }) {
    return this.authService.logout(body.sessionId)
  }

  @Post('refresh')
  async refresh(@Body() body: RefreshDto) {
    return this.authService.refresh(body.refreshToken)
  }

  @Get('google')
  @UseGuards(AuthGuard('google'))
  async googleAuth() {
    return
  }

  @Get('google/callback')
  @UseGuards(AuthGuard('google'))
  async googleAuthCallback(@Req() req: any) {
    const ip = req.ip || req.headers['x-forwarded-for'] || null
    return this.authService.findOrCreateGoogleUser(req.user, req.headers['user-agent'], ip)
  }

  @Post('forgot-password')
  async forgot(@Body() body: ForgotPasswordDto) {
    return this.authService.forgotPassword(body.email)
  }

  @Post('reset-password')
  async reset(@Body() body: ResetPasswordDto) {
    return this.authService.resetPassword(body.token, body.newPassword)
  }

  @Post('verify-email')
  async verify(@Body() body: VerifyEmailDto) {
    return this.authService.verifyEmail(body.token)
  }

  @UseGuards(JwtGuard)
  @Post('change-password')
  async changePassword(@User() user: any, @Body() body: ChangePasswordDto) {
    return this.authService.changePassword(user.id, body.currentPassword, body.newPassword)
  }

  @UseGuards(JwtGuard)
  @Post('2fa/generate')
  async generate2fa(@User() user: any) {
    return this.authService.generate2FACode(user.id)
  }

  @UseGuards(JwtGuard)
  @Post('2fa/verify')
  async verify2fa(@User() user: any, @Body() body: TwoFactorVerifyDto) {
    return this.authService.verify2FA(user.id, body.code)
  }
}
