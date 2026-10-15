import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { type RenderOptions, render } from "@testing-library/react";
import { ThemeProvider } from "next-themes";
import type { ReactElement, ReactNode } from "react";

export function createTestQueryClient() {
	return new QueryClient({
		defaultOptions: {
			queries: { retry: false, gcTime: 0 },
			mutations: { retry: false },
		},
	});
}

interface TestProviderOptions {
	queryClient?: QueryClient;
}

function createTestProviders({ queryClient }: TestProviderOptions = {}) {
	const client = queryClient ?? createTestQueryClient();

	return function TestProviders({ children }: { children: ReactNode }) {
		return (
			<QueryClientProvider client={client}>
				<ThemeProvider attribute="class" defaultTheme="system" enableSystem>
					{children}
				</ThemeProvider>
			</QueryClientProvider>
		);
	};
}

export function renderWithProviders(
	ui: ReactElement,
	options?: Omit<RenderOptions, "wrapper"> & TestProviderOptions,
) {
	const { queryClient, ...renderOptions } = options ?? {};
	return render(ui, {
		wrapper: createTestProviders({ queryClient }),
		...renderOptions,
	});
}
