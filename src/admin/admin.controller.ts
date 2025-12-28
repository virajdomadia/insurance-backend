import { Controller, Post, Body, UseGuards, Get } from '@nestjs/common';
import { AdminService } from './admin.service';
import { Roles } from '../auth/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt.guard';

class AssignNgoDto {
	userId: string;
}

class ActivateDto {
	userId: string;
	isActive: boolean;
}

@Controller('admin')
@UseGuards(JwtAuthGuard)
@Roles('ADMIN')
export class AdminController {
	constructor(private adminService: AdminService) {}

	@Post('assign-ngo')
	async assignNgo(@Body() body: AssignNgoDto) {
		return this.adminService.assignNgo(body.userId);
	}

	@Post('activate')
	async activate(@Body() body: ActivateDto) {
		return this.adminService.setActive(body.userId, body.isActive);
	}

	@Get('users')
	async listUsers() {
		return this.adminService.listUsers();
	}
}
