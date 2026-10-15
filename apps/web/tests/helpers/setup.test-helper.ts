import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { createElement } from "react";
import { afterEach, vi } from "vitest";
import "./clerk.test-helper";
import "./navigation.test-helper";
import { orpc, resetOrpcMocks } from "../orpc/client.test-handler";

Object.defineProperty(window, "matchMedia", {
	writable: true,
	value: (query: string) => ({
		matches: false,
		media: query,
		onchange: null,
		addListener: () => {},
		removeListener: () => {},
		addEventListener: () => {},
		removeEventListener: () => {},
		dispatchEvent: () => false,
	}),
});

vi.mock("next/image", () => ({
	default: (props: Record<string, unknown>) => {
		const { fill, priority, placeholder, blurDataURL, ...rest } = props;
		return createElement("img", rest);
	},
}));

vi.mock("../../src/utils/orpc", () => ({
	orpc,
}));

afterEach(() => {
	resetOrpcMocks();
	cleanup();
});
