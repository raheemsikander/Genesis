"use client";

import {
	Alert,
	AlertAction,
	AlertDescription,
	AlertTitle,
} from "@repo/ui/components/alert";
import {
	AlertDialog,
	AlertDialogAction,
	AlertDialogCancel,
	AlertDialogContent,
	AlertDialogDescription,
	AlertDialogFooter,
	AlertDialogHeader,
	AlertDialogTitle,
	AlertDialogTrigger,
} from "@repo/ui/components/alert-dialog";
import { Badge } from "@repo/ui/components/badge";
import { Button } from "@repo/ui/components/button";
import {
	Card,
	CardContent,
	CardHeader,
	CardTitle,
} from "@repo/ui/components/card";
import { Checkbox } from "@repo/ui/components/checkbox";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
	DialogTrigger,
} from "@repo/ui/components/dialog";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "@repo/ui/components/dropdown-menu";
import { Input } from "@repo/ui/components/input";
import { Label } from "@repo/ui/components/label";
import { Separator } from "@repo/ui/components/separator";
import {
	Sheet,
	SheetContent,
	SheetDescription,
	SheetHeader,
	SheetTitle,
	SheetTrigger,
} from "@repo/ui/components/sheet";
import { Skeleton } from "@repo/ui/components/skeleton";
import { Spinner } from "@repo/ui/components/spinner";
import { Textarea } from "@repo/ui/components/textarea";
import {
	Tooltip,
	TooltipContent,
	TooltipProvider,
	TooltipTrigger,
} from "@repo/ui/components/tooltip";
import {
	AlertCircleIcon,
	AlertTriangleIcon,
	CheckCircle2Icon,
	HomeIcon,
	InfoIcon,
	Settings,
	Trash2,
} from "lucide-react";
import { toast } from "sonner";
import { BaseLayout } from "../../../components/base-layout";

const buttonTones = [
	"primary",
	"secondary",
	"success",
	"destructive",
	"warning",
] as const;
const buttonVariantList = ["solid", "outline", "ghost", "link"] as const;
const buttonSizes = ["sm", "default", "lg"] as const;
const badgeTones = [
	"primary",
	"secondary",
	"success",
	"destructive",
	"warning",
	"info",
] as const;

export default function ComponentsPage() {
	return (
		<BaseLayout
			title="Component Showcase"
			description="All available UI components. Click to interact."
		>
			<div className="space-y-6">
				{/* Buttons */}
				<Card>
					<CardHeader>
						<CardTitle>Buttons — Tone × Variant</CardTitle>
					</CardHeader>
					<CardContent className="space-y-6">
						{buttonTones.map((tone) => (
							<div key={tone}>
								<p className="section-label mb-2">{tone}</p>
								<div className="space-y-2">
									{buttonVariantList.map((variant) => (
										<div
											key={variant}
											className="flex flex-wrap items-center gap-2"
										>
											<span className="w-16 text-muted-foreground text-xs">
												{variant}
											</span>
											{buttonSizes.map((size) => (
												<Button
													key={size}
													tone={tone}
													variant={variant}
													size={size}
												>
													{size}
												</Button>
											))}
											<Button tone={tone} variant={variant} disabled>
												disabled
											</Button>
										</div>
									))}
								</div>
							</div>
						))}
						<Separator />
						<div>
							<p className="section-label mb-2">With Icons</p>
							<div className="flex flex-wrap gap-2">
								<Button>
									<HomeIcon />
									Home
								</Button>
								<Button variant="outline">
									<InfoIcon />
									Info
								</Button>
								<Button tone="destructive">
									<Trash2 />
									Delete
								</Button>
								<Button variant="ghost">
									<Settings />
									Settings
								</Button>
							</div>
						</div>
					</CardContent>
				</Card>

				{/* Badges */}
				<Card>
					<CardHeader>
						<CardTitle>Badges — Tone × Variant</CardTitle>
					</CardHeader>
					<CardContent className="space-y-3">
						<div>
							<p className="section-label mb-2">Solid</p>
							<div className="flex flex-wrap gap-2">
								{badgeTones.map((tone) => (
									<Badge key={tone} tone={tone} variant="solid">
										{tone}
									</Badge>
								))}
							</div>
						</div>
						<div>
							<p className="section-label mb-2">Outline</p>
							<div className="flex flex-wrap gap-2">
								{badgeTones.map((tone) => (
									<Badge key={tone} tone={tone} variant="outline">
										{tone}
									</Badge>
								))}
							</div>
						</div>
					</CardContent>
				</Card>

				{/* Alerts */}
				<Card>
					<CardHeader>
						<CardTitle>Alerts</CardTitle>
					</CardHeader>
					<CardContent className="space-y-3">
						<Alert variant="success">
							<AlertTitle>Success</AlertTitle>
							<AlertDescription>Your changes have been saved.</AlertDescription>
						</Alert>
						<Alert variant="destructive">
							<AlertTitle>Destructive</AlertTitle>
							<AlertDescription>
								Something went wrong. Please try again.
							</AlertDescription>
						</Alert>
						<Alert variant="warning">
							<AlertTitle>Warning</AlertTitle>
							<AlertDescription>
								Review your input before proceeding.
							</AlertDescription>
						</Alert>
						<Alert variant="info">
							<AlertTitle>Info</AlertTitle>
							<AlertDescription>
								Here is some useful information.
							</AlertDescription>
						</Alert>
						<Alert variant="warning">
							<AlertTitle>With Action</AlertTitle>
							<AlertDescription>Your trial expires in 3 days.</AlertDescription>
							<AlertAction>
								<Button tone="warning" variant="outline" size="sm">
									Upgrade
								</Button>
							</AlertAction>
						</Alert>
						<Alert variant="destructive">
							<AlertTitle>With Action</AlertTitle>
							<AlertDescription>
								This resource will be deleted permanently.
							</AlertDescription>
							<AlertAction>
								<Button tone="destructive" variant="outline" size="sm">
									Undo
								</Button>
							</AlertAction>
						</Alert>
					</CardContent>
				</Card>

				{/* Toasts */}
				<Card>
					<CardHeader>
						<CardTitle>Toasts</CardTitle>
					</CardHeader>
					<CardContent className="flex flex-wrap gap-2">
						<Button
							tone="success"
							variant="outline"
							onClick={() =>
								toast.success("Success!", {
									description: "Your action completed.",
								})
							}
						>
							<CheckCircle2Icon />
							Success
						</Button>
						<Button
							tone="destructive"
							variant="outline"
							onClick={() =>
								toast.error("Error!", { description: "Something went wrong." })
							}
						>
							<AlertCircleIcon />
							Error
						</Button>
						<Button
							tone="warning"
							variant="outline"
							onClick={() =>
								toast.warning("Warning!", {
									description: "Review before proceeding.",
								})
							}
						>
							<AlertTriangleIcon />
							Warning
						</Button>
						<Button
							tone="primary"
							variant="outline"
							onClick={() =>
								toast.info("Info!", {
									description: "Here is some information.",
								})
							}
						>
							<InfoIcon />
							Info
						</Button>
					</CardContent>
				</Card>

				{/* Form Inputs */}
				<Card>
					<CardHeader>
						<CardTitle>Form Inputs</CardTitle>
					</CardHeader>
					<CardContent className="space-y-4">
						<div className="form-row">
							<div className="form-container flex-1">
								<Label htmlFor="first">First Name</Label>
								<Input id="first" placeholder="Jane" />
							</div>
							<div className="form-container flex-1">
								<Label htmlFor="last">Last Name</Label>
								<Input id="last" placeholder="Doe" />
							</div>
						</div>
						<div className="form-container">
							<Label htmlFor="email">Email</Label>
							<Input id="email" type="email" placeholder="jane@example.com" />
							<p className="help-text">We'll never share your email.</p>
						</div>
						<div className="form-container">
							<Label htmlFor="invalid-email">Invalid Input</Label>
							<Input
								id="invalid-email"
								type="email"
								placeholder="bad@email"
								aria-invalid="true"
							/>
							<p className="invalid-input">
								Please enter a valid email address.
							</p>
						</div>
						<div className="form-container">
							<Label htmlFor="message">Message</Label>
							<Textarea id="message" placeholder="Type your message here..." />
						</div>
						<div className="form-container">
							<Label htmlFor="invalid-message">Invalid Textarea</Label>
							<Textarea
								id="invalid-message"
								placeholder="Required field..."
								aria-invalid="true"
							/>
							<p className="invalid-input">This field is required.</p>
						</div>
						<div className="form-container">
							<Label htmlFor="disabled-input">Disabled</Label>
							<Input id="disabled-input" placeholder="Not editable" disabled />
						</div>
						<Separator />
						<p className="section-label">Checkboxes</p>
						<div className="space-y-3">
							<div className="flex items-center gap-2">
								<Checkbox id="terms" />
								<Label htmlFor="terms">Accept terms and conditions</Label>
							</div>
							<div className="flex items-center gap-2">
								<Checkbox id="checked" defaultChecked />
								<Label htmlFor="checked">Checked by default</Label>
							</div>
							<div className="flex items-center gap-2">
								<Checkbox id="disabled" disabled />
								<Label htmlFor="disabled">Disabled</Label>
							</div>
							<div className="flex items-center gap-2">
								<Checkbox id="invalid" aria-invalid="true" />
								<Label htmlFor="invalid">Invalid checkbox</Label>
							</div>
						</div>
						<Separator />
						<div className="form-actions">
							<Button tone="secondary" variant="outline">
								Cancel
							</Button>
							<Button>Submit</Button>
						</div>
					</CardContent>
				</Card>

				{/* Dialog */}
				<Card>
					<CardHeader>
						<CardTitle>Dialog</CardTitle>
					</CardHeader>
					<CardContent>
						<Dialog>
							<DialogTrigger render={<Button variant="outline" />}>
								Open Dialog
							</DialogTrigger>
							<DialogContent>
								<DialogHeader>
									<DialogTitle>Edit Profile</DialogTitle>
									<DialogDescription>
										Make changes to your profile here. Click save when you're
										done.
									</DialogDescription>
								</DialogHeader>
								<div className="form-container py-2">
									<Label htmlFor="dialog-name">Name</Label>
									<Input id="dialog-name" placeholder="Jane Doe" />
								</div>
								<DialogFooter>
									<Button tone="secondary" variant="outline">
										Cancel
									</Button>
									<Button>Save changes</Button>
								</DialogFooter>
							</DialogContent>
						</Dialog>
					</CardContent>
				</Card>

				{/* AlertDialog */}
				<Card>
					<CardHeader>
						<CardTitle>Alert Dialog</CardTitle>
					</CardHeader>
					<CardContent>
						<AlertDialog>
							<AlertDialogTrigger
								render={<Button tone="destructive" variant="outline" />}
							>
								Delete Account
							</AlertDialogTrigger>
							<AlertDialogContent>
								<AlertDialogHeader>
									<AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
									<AlertDialogDescription>
										This action cannot be undone. This will permanently delete
										your account and remove your data from our servers.
									</AlertDialogDescription>
								</AlertDialogHeader>
								<AlertDialogFooter>
									<AlertDialogCancel>Cancel</AlertDialogCancel>
									<AlertDialogAction>Delete Account</AlertDialogAction>
								</AlertDialogFooter>
							</AlertDialogContent>
						</AlertDialog>
					</CardContent>
				</Card>

				{/* Sheet */}
				<Card>
					<CardHeader>
						<CardTitle>Sheet</CardTitle>
					</CardHeader>
					<CardContent className="flex gap-2">
						<Sheet>
							<SheetTrigger render={<Button variant="outline" />}>
								Open Right Sheet
							</SheetTrigger>
							<SheetContent side="right">
								<SheetHeader>
									<SheetTitle>Sheet Title</SheetTitle>
									<SheetDescription>
										This is a side panel that slides in from the right.
									</SheetDescription>
								</SheetHeader>
							</SheetContent>
						</Sheet>
						<Sheet>
							<SheetTrigger render={<Button variant="outline" />}>
								Open Left Sheet
							</SheetTrigger>
							<SheetContent side="left">
								<SheetHeader>
									<SheetTitle>Sheet Title</SheetTitle>
									<SheetDescription>
										This is a side panel that slides in from the left.
									</SheetDescription>
								</SheetHeader>
							</SheetContent>
						</Sheet>
					</CardContent>
				</Card>

				{/* Tooltip */}
				<Card>
					<CardHeader>
						<CardTitle>Tooltips</CardTitle>
					</CardHeader>
					<CardContent className="flex flex-wrap gap-3">
						<TooltipProvider>
							<Tooltip>
								<TooltipTrigger render={<Button variant="outline" />}>
									Hover me
								</TooltipTrigger>
								<TooltipContent>This is a tooltip</TooltipContent>
							</Tooltip>
						</TooltipProvider>
						<TooltipProvider>
							<Tooltip>
								<TooltipTrigger
									render={<Button tone="destructive" variant="ghost" />}
								>
									<Trash2 />
									Delete
								</TooltipTrigger>
								<TooltipContent>Permanently delete this item</TooltipContent>
							</Tooltip>
						</TooltipProvider>
					</CardContent>
				</Card>

				{/* Spinners */}
				<Card>
					<CardHeader>
						<CardTitle>Spinners</CardTitle>
					</CardHeader>
					<CardContent className="flex flex-wrap items-center gap-4">
						<div className="flex flex-col items-center gap-1">
							<Spinner className="size-3" />
							<span className="text-muted-foreground text-xs">xs</span>
						</div>
						<div className="flex flex-col items-center gap-1">
							<Spinner className="size-4" />
							<span className="text-muted-foreground text-xs">sm</span>
						</div>
						<div className="flex flex-col items-center gap-1">
							<Spinner className="size-6" />
							<span className="text-muted-foreground text-xs">default</span>
						</div>
						<div className="flex flex-col items-center gap-1">
							<Spinner className="size-8" />
							<span className="text-muted-foreground text-xs">lg</span>
						</div>
						<div className="flex flex-col items-center gap-1">
							<Spinner className="size-12 text-success-foreground" />
							<span className="text-muted-foreground text-xs">colored</span>
						</div>
					</CardContent>
				</Card>

				{/* Dropdown Menu */}
				<Card>
					<CardHeader>
						<CardTitle>Dropdown Menus</CardTitle>
					</CardHeader>
					<CardContent className="flex flex-wrap gap-3">
						<DropdownMenu>
							<DropdownMenuTrigger render={<Button variant="outline" />}>
								Basic Menu
							</DropdownMenuTrigger>
							<DropdownMenuContent>
								<DropdownMenuItem>Profile</DropdownMenuItem>
								<DropdownMenuItem>Settings</DropdownMenuItem>
								<DropdownMenuSeparator />
								<DropdownMenuItem variant="destructive">
									Logout
								</DropdownMenuItem>
							</DropdownMenuContent>
						</DropdownMenu>
					</CardContent>
				</Card>

				{/* Skeletons */}
				<Card>
					<CardHeader>
						<CardTitle>Skeletons</CardTitle>
					</CardHeader>
					<CardContent className="space-y-3">
						<div className="flex items-center gap-3">
							<Skeleton className="h-10 w-10 rounded-full" />
							<div className="flex-1 space-y-2">
								<Skeleton className="h-4 w-2/3" />
								<Skeleton className="h-3 w-1/2" />
							</div>
						</div>
						<Skeleton className="h-4 w-full" />
						<Skeleton className="h-4 w-5/6" />
						<Skeleton className="h-28 w-full rounded-md" />
					</CardContent>
				</Card>

				{/* Separators */}
				<Card>
					<CardHeader>
						<CardTitle>Separators</CardTitle>
					</CardHeader>
					<CardContent className="space-y-4">
						<div>
							<p className="section-label mb-2">Horizontal</p>
							<Separator />
						</div>
						<div className="flex items-center gap-4">
							<p className="text-muted-foreground text-sm">Left</p>
							<Separator orientation="vertical" className="h-6" />
							<p className="text-muted-foreground text-sm">Right</p>
						</div>
					</CardContent>
				</Card>
			</div>
		</BaseLayout>
	);
}
