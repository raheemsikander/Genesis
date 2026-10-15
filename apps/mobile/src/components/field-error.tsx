import { Text } from "./ui";

export function FieldError({
	field,
}: {
	field: {
		state: {
			meta: {
				isTouched: boolean;
				errors: Array<{ message?: string } | undefined>;
			};
		};
	};
}) {
	if (!field.state.meta.isTouched || field.state.meta.errors.length === 0) {
		return null;
	}
	return (
		<Text className="text-destructive text-sm">
			{field.state.meta.errors[0]?.message}
		</Text>
	);
}
