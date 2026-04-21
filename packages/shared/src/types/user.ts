export interface User {
  id: string;
  username: string;
  phone: string;
  avatar?: string;
  role: UserRole;
  createdAt: string;
  updatedAt: string;
}

export type UserRole = 'student' | 'admin';

export interface LoginByPasswordDto {
  phone: string;
  password: string;
}

export interface LoginByCodeDto {
  phone: string;
  code: string;
}

export interface RegisterDto {
  phone: string;
  username: string;
  password: string;
  confirmPassword: string;
}

export interface UpdatePasswordDto {
  oldPassword: string;
  newPassword: string;
  confirmNewPassword: string;
}

export interface AuthToken {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}
