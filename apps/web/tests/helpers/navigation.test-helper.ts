import { afterEach, vi } from "vitest";

export const mockRouter = {
	push: vi.fn(),
	replace: vi.fn(),
	back: vi.fn(),
	forward: vi.fn(),
	refresh: vi.fn(),
	prefetch: vi.fn(),
};

export const mockRedirect = vi.fn();

vi.mock("next/navigation", () => ({
	useRouter: () => mockRouter,
	usePathname: () => "/",
	useSearchParams: () => new URLSearchParams(),
	useParams: () => ({}),
	redirect: mockRedirect,
}));

afterEach(() => {
	mockRouter.push.mockReset();
	mockRouter.replace.mockReset();
	mockRouter.back.mockReset();
	mockRouter.forward.mockReset();
	mockRouter.refresh.mockReset();
	mockRouter.prefetch.mockReset();
	mockRedirect.mockReset();
});
