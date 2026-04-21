import http from './http';
import type { LoginByPasswordDto, LoginByCodeDto, RegisterDto, UpdatePasswordDto, User, AuthToken } from '@kaoyan/shared';
import { USE_MOCK } from '@/mock/config';
import { mockAuthApi } from '@/mock/handlers/auth';

export interface LoginResponse {
  user: User;
  token: AuthToken;
}

const realAuthApi = {
  loginByPassword: (data: LoginByPasswordDto) =>
    http.post<LoginResponse, LoginResponse>('/auth/login/password', data),

  loginByCode: (data: LoginByCodeDto) =>
    http.post<LoginResponse, LoginResponse>('/auth/login/code', data),

  sendCode: (phone: string) =>
    http.post('/auth/send-code', { phone }),

  register: (data: RegisterDto) =>
    http.post<LoginResponse, LoginResponse>('/auth/register', data),

  updatePassword: (data: UpdatePasswordDto) =>
    http.put('/auth/password', data),

  getProfile: () =>
    http.get<User, User>('/auth/profile'),

  updateProfile: (data: Partial<Pick<User, 'username' | 'avatar'>>) =>
    http.put<User, User>('/auth/profile', data),
};

export const authApi = USE_MOCK ? mockAuthApi : realAuthApi;
