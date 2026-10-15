import { useAuth } from "@clerk/expo";
import {
	Button,
	Form,
	Host,
	Label,
	type LabelProps,
	Section,
} from "@expo/ui/swift-ui";
import { useRouter } from "expo-router";
import { moreLinks } from "../config/navigation-items";

/**
 * iOS variant of the More screen: a real SwiftUI inset-grouped Form (Tier 2 of
 * the native UI strategy, see apps/mobile/CLAUDE.md). The Android fallback
 * lives in `more-list.android.tsx`.
 */
export function MoreList() {
	const { signOut } = useAuth();
	const router = useRouter();
	const sections = [
		{
			title: "Account",
			links: moreLinks.filter((l) => l.section === "account"),
		},
		{
			title: "Platform",
			links: moreLinks.filter((l) => l.section === "platform"),
		},
	];

	return (
		<Host style={{ flex: 1 }} useViewportSizeMeasurement>
			<Form>
				{sections.map((section) => (
					<Section key={section.title} title={section.title}>
						{section.links.map((link) => (
							<Button key={link.title} onPress={() => router.push(link.href)}>
								<Label
									title={link.title}
									systemImage={link.sfSymbol as LabelProps["systemImage"]}
								/>
							</Button>
						))}
					</Section>
				))}
				<Section>
					{/* biome-ignore lint/a11y/useValidAriaRole: SwiftUI button role, not an ARIA role */}
					<Button
						role="destructive"
						label="Sign out"
						onPress={() => signOut()}
					/>
				</Section>
			</Form>
		</Host>
	);
}
