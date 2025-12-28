import {
	Controller,
	Post,
	Body,
	Res,
	HttpCode,
	UseGuards,
	Req,
	UnauthorizedException,
} from '@nestjs/common';
import type { Response, Request } from 'express';
import { AuthService } from './auth.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { JwtAuthGuard } from './guards/jwt.guard';

@Controller('auth')
export class AuthController {
	constructor(private authService: AuthService) {}

	@Post('register')
	async register(@Body() body: RegisterDto) {
		// role cannot be provided by client; enforced in service
		return this.authService.register(body.email, body.password);
	}

	@HttpCode(200)
	@Post('login')
	async login(@Body() body: LoginDto, @Res({ passthrough: true }) res: Response) {
		const user = await this.authService.validateCredentials(body.email, body.password);
		if (!user) throw new UnauthorizedException('Invalid credentials');
		const accessToken = await this.authService.issueAccessToken({ id: user.id, role: user.role });
		const { token: refreshToken, expiresAt } = await this.authService.createRefreshToken(user.id);

		const cookieOptions = {
			httpOnly: true,
			secure: process.env.NODE_ENV === 'production',
			sameSite: 'lax' as const,
			path: '/',
			maxAge: Math.floor((expiresAt.getTime() - Date.now()) / 1000) * 1000,
		};
		res.cookie('refreshToken', refreshToken, cookieOptions);
		return { accessToken };
	}

	@HttpCode(200)
	@Post('refresh')
	async refresh(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
		const token = req.cookies?.refreshToken;
		if (!token) throw new UnauthorizedException('No refresh token');
		const record = await this.authService.validateRefreshToken(token);
		if (!record) throw new UnauthorizedException('Invalid refresh token');
		const user = await (this.authService.prisma as any).user.findUnique({ where: { id: record.userId } });
		if (!user) throw new UnauthorizedException('User not found');
		if (!(user as any).isActive) throw new UnauthorizedException('User deactivated');

		const accessToken = await this.authService.issueAccessToken({ id: user.id, role: user.role });
		return { accessToken };
	}

	@UseGuards(JwtAuthGuard)
	@Post('logout')
	async logout(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
		const token = req.cookies?.refreshToken;
		if (token) await this.authService.revokeRefreshToken(token);
		res.clearCookie('refreshToken', { path: '/' });
		return { ok: true };
	}
}
