import type { LoginByPasswordDto, LoginByCodeDto, RegisterDto, UpdatePasswordDto, User } from '@kaoyan/shared';
import { MOCK_USER, MOCK_TOKEN } from '../data';
import type { LoginResponse } from '@/api/auth';

const delay = (ms = 400) => new Promise<void>((resolve) => setTimeout(resolve, ms));

export const mockAuthApi = {
  async loginByPassword(_data: LoginByPasswordDto): Promise<LoginResponse> {
    await delay();
    return { user: { ...MOCK_USER }, token: { ...MOCK_TOKEN } };
  },

  async loginByCode(_data: LoginByCodeDto): Promise<LoginResponse> {
    await delay();
    return { user: { ...MOCK_USER }, token: { ...MOCK_TOKEN } };
  },

  async sendCode(_phone: string): Promise<void> {
    await delay(300);
  },

  async register(_data: RegisterDto): Promise<LoginResponse> {
    await delay();
    return { user: { ...MOCK_USER }, token: { ...MOCK_TOKEN } };
  },

  async updatePassword(_data: UpdatePasswordDto): Promise<void> {
    await delay();
  },

  async getProfile(): Promise<User> {
    await delay(200);
    return { ...MOCK_USER };
  },

  async updateProfile(data: Partial<Pick<User, 'username' | 'avatar'>>): Promise<User> {
    await delay();
    return { ...MOCK_USER, ...data };
  },
};
