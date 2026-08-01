import { Injectable, BadRequestException, UnauthorizedException } from '@nestjs/common'
import { PrismaService } from '../prisma/prisma.service'
import * as bcrypt from 'bcrypt'
import { sign, verify, Secret, SignOptions } from 'jsonwebtoken'
import type { StringValue } from 'ms'
import { randomBytes } from 'crypto'
import { MailService } from '../mail/mail.service'
import { getJwtSecret } from './jwt-secret'

@Injectable()
export class AuthService {
  constructor(private prisma: PrismaService, private mail: MailService) {}

  signAccessToken(userId: string) {
    const secret: Secret = getJwtSecret()
    const expiresInVal = (process.env.JWT_EXPIRES_IN || '1h') as StringValue
    const opts: SignOptions = { expiresIn: expiresInVal }
    return sign({ sub: userId, type: 'access' }, secret, opts)
  }

  signRefreshToken(userId: string, sessionId: string, expiresIn: string | number = process.env.REFRESH_TOKEN_EXPIRES_IN || '30d') {
    const secret: Secret = getJwtSecret()
    const expiresInVal = (typeof expiresIn === 'string' ? (expiresIn as StringValue) : expiresIn) as StringValue | number
    const opts: SignOptions = { expiresIn: expiresInVal }
    return sign({ sub: userId, sid: sessionId, type: 'refresh' }, secret, opts)
  }

  async register(email: string, username: string, password: string) {
    const existing = await this.prisma.user.findFirst({ where: { OR: [{ email }, { username }] } })
    if (existing) throw new BadRequestException('Email or username already in use')
    const passwordHash = await bcrypt.hash(password, 10)
    const user = await this.prisma.user.create({ data: { email, username, passwordHash } })
    await this.sendVerification(user.id, user.email)
    const token = this.signAccessToken(user.id)
    return { user, token }
  }

  async login(email: string, password: string, userAgent?: string, ip?: string) {
    const user = await this.prisma.user.findUnique({ where: { email } })
    if (!user) throw new UnauthorizedException('Invalid credentials')
    if (user.isLocked && user.lockedUntil && user.lockedUntil > new Date()) throw new UnauthorizedException('Account locked')
    const ok = await bcrypt.compare(password, user.passwordHash)
    if (!ok) {
      // TODO: increment failed attempt counter (redis)
      throw new UnauthorizedException('Invalid credentials')
    }
    return this.createSessionResponse(user.id, userAgent, ip)
  }

  async findOrCreateGoogleUser(profile: any, userAgent?: string, ip?: string) {
    const email = profile.emails?.[0]?.value
    if (!email) throw new BadRequestException('Google account did not provide an email')

    let user = await this.prisma.user.findUnique({ where: { googleId: profile.id } })

    if (!user) {
      user = await this.prisma.user.findUnique({ where: { email } })
    }

    if (user) {
      user = await this.prisma.user.update({
        where: { id: user.id },
        data: {
          googleId: profile.id,
          displayName: user.displayName || profile.displayName,
          avatar: user.avatar || profile.photos?.[0]?.value,
          isVerified: true,
        },
      })
    } else {
      const baseUsername = email.split('@')[0].replace(/[^a-zA-Z0-9]/g, '') || 'googleuser'
      const username = await this.createUniqueUsername(baseUsername)
      user = await this.prisma.user.create({
        data: {
          email,
          username,
          googleId: profile.id,
          displayName: profile.displayName,
          avatar: profile.photos?.[0]?.value,
          isVerified: true,
          passwordHash: await bcrypt.hash(randomBytes(16).toString('hex'), 10),
        },
      })
    }

    return this.createSessionResponse(user.id, userAgent, ip)
  }

  private async createUniqueUsername(base: string) {
    let username = base.slice(0, 20)
    let counter = 0
    while (await this.prisma.user.findUnique({ where: { username } })) {
      counter += 1
      username = `${base.slice(0, 14)}${counter}`
    }
    return username
  }

  private async createSessionResponse(userId: string, userAgent?: string, ip?: string) {
    const session = await this.prisma.userSession.create({
      data: {
        userId,
        userAgent: userAgent || null,
        ip: ip || null,
        expiresAt: new Date(Date.now() + 1000 * 60 * 60 * 24 * 30),
      },
    })
    const accessToken = this.signAccessToken(userId)
    const refreshToken = this.signRefreshToken(userId, session.id)
    return { accessToken, refreshToken, expiresIn: process.env.JWT_EXPIRES_IN || '1h', sessionId: session.id }
  }

  async logout(sessionId: string) {
    await this.prisma.userSession.deleteMany({ where: { id: sessionId } })
    return { ok: true }
  }

  async refresh(refreshToken: string) {
    try {
      const secret: Secret = getJwtSecret()
      const payload = verify(refreshToken, secret) as any
      if (payload.type !== 'refresh') throw new UnauthorizedException()
      const session = await this.prisma.userSession.findUnique({ where: { id: payload.sid } })
      if (!session) throw new UnauthorizedException()
      if (session.expiresAt < new Date()) throw new UnauthorizedException()
      const accessToken = this.signAccessToken(payload.sub)
      const newRefreshToken = this.signRefreshToken(payload.sub, session.id)
      return { accessToken, refreshToken: newRefreshToken }
    } catch (err) {
      throw new UnauthorizedException()
    }
  }

  async forgotPassword(email: string) {
    const user = await this.prisma.user.findUnique({ where: { email } })
    if (!user) return { ok: true }
    const token = randomBytes(24).toString('hex')
    const expiresAt = new Date(Date.now() + 1000 * 60 * 60) // 1h
    await this.prisma.passwordResetToken.create({ data: { userId: user.id, token, expiresAt } })
    await this.mail.sendPasswordReset(user.email, token)
    return { ok: true }
  }

  async resetPassword(token: string, newPassword: string) {
    const record = await this.prisma.passwordResetToken.findUnique({ where: { token } })
    if (!record || record.expiresAt < new Date()) throw new BadRequestException('Invalid or expired token')
    const passwordHash = await bcrypt.hash(newPassword, 10)
    await this.prisma.user.update({ where: { id: record.userId }, data: { passwordHash } })
    await this.prisma.passwordResetToken.deleteMany({ where: { id: record.id } })
    return { ok: true }
  }

  async sendVerification(userId: string, email?: string) {
    const token = randomBytes(24).toString('hex')
    const expiresAt = new Date(Date.now() + 1000 * 60 * 60 * 24) // 24h
    await this.prisma.verificationToken.create({ data: { userId, token, expiresAt } })
    const user = await this.prisma.user.findUnique({ where: { id: userId } })
    if (user && user.email) await this.mail.sendVerification(user.email, token)
    return { ok: true }
  }

  async verifyEmail(token: string) {
    const record = await this.prisma.verificationToken.findUnique({ where: { token } })
    if (!record || record.expiresAt < new Date()) throw new BadRequestException('Invalid or expired token')
    await this.prisma.user.update({ where: { id: record.userId }, data: { isVerified: true } })
    await this.prisma.verificationToken.deleteMany({ where: { id: record.id } })
    return { ok: true }
  }

  async changePassword(userId: string, currentPassword: string, newPassword: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } })
    if (!user) throw new UnauthorizedException()
    const ok = await bcrypt.compare(currentPassword, user.passwordHash)
    if (!ok) throw new BadRequestException('Current password incorrect')
    const passwordHash = await bcrypt.hash(newPassword, 10)
    await this.prisma.user.update({ where: { id: userId }, data: { passwordHash } })
    return { ok: true }
  }

  async generate2FACode(userId: string) {
    const code = Math.floor(100000 + Math.random() * 900000).toString()
    const expiresAt = new Date(Date.now() + 1000 * 60 * 10)
    await this.prisma.twoFactorCode.create({ data: { userId, code, expiresAt } })
    const user = await this.prisma.user.findUnique({ where: { id: userId } })
    if (user && user.email) {
      // reuse mailer
      await this.mail.sendVerification(user.email, `2fa:${code}`)
    }
    return { ok: true }
  }

  async verify2FA(userId: string, code: string) {
    const record = await this.prisma.twoFactorCode.findFirst({ where: { userId, code } })
    if (!record || record.expiresAt < new Date()) throw new BadRequestException('Invalid or expired code')
    await this.prisma.twoFactorCode.deleteMany({ where: { id: record.id } })
    return { ok: true }
  }
}
