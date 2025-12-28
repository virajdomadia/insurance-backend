import { Injectable, NotFoundException } from '@nestjs/common';
import { UsersService } from '../users/users.service';
import { UserRole } from '@prisma/client';

@Injectable()
export class AdminService {
	constructor(private usersService: UsersService) {}

	async assignNgo(userId: string) {
		const user = await this.usersService.findById(userId);
		if (!user) throw new NotFoundException('User not found');
		return this.usersService.setRole(userId, 'NGO');
	}

	async setActive(userId: string, isActive: boolean) {
		const user = await this.usersService.findById(userId);
		if (!user) throw new NotFoundException('User not found');
		return this.usersService.setActive(userId, isActive);
	}

	async listUsers() {
		return this.usersService.list();
	}
}
