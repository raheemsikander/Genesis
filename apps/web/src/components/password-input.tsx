"use client";

import { Input } from "@repo/ui/components/input";
import { EyeIcon, EyeOffIcon } from "lucide-react";
import { useState } from "react";

interface PasswordInputProps {
	id: string;
	name: string;
	value?: string;
	onChange?: (e: React.ChangeEvent<HTMLInputElement>) => void;
	onFocus?: () => void;
	onBlur?: () => void;
	required?: boolean;
}

export function PasswordInput({
	id,
	name,
	value,
	onChange,
	onFocus,
	onBlur,
	required,
}: PasswordInputProps) {
	const [visible, setVisible] = useState(false);

	return (
		<div className="relative">
			<Input
				id={id}
				name={name}
				type={visible ? "text" : "password"}
				value={value}
				onChange={onChange}
				onFocus={onFocus}
				onBlur={onBlur}
				required={required}
				className="pr-9"
			/>
			<button
				type="button"
				tabIndex={-1}
				onClick={() => setVisible(!visible)}
				className="absolute top-1/2 right-2.5 -translate-y-1/2 text-muted-foreground transition-colors hover:text-foreground"
			>
				{visible ? (
					<EyeOffIcon className="h-4 w-4" />
				) : (
					<EyeIcon className="h-4 w-4" />
				)}
			</button>
		</div>
	);
}
