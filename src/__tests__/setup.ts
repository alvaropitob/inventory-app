import '@testing-library/jest-dom';
import { vi } from 'vitest';

// Mocking Supabase and other global modules if needed
vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(),
}));

vi.mock('next/navigation', () => ({
  redirect: vi.fn(),
  revalidatePath: vi.fn(),
}));
