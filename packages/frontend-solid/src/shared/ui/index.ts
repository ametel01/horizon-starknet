// UI primitives - Kobalte-based components for SolidJS

// Alert
export { Alert, AlertAction, AlertDescription, alertVariants, AlertTitle } from './Alert';
export type { AlertProps, AlertTitleProps, AlertDescriptionProps, AlertActionProps } from './Alert';

// AnimatedNumber
export {
  AnimatedCurrency,
  AnimatedNumber,
  AnimatedPercent,
  createAnimatedNumber,
  easings,
} from './AnimatedNumber';
export type {
  AnimatedCurrencyProps,
  AnimatedNumberProps,
  AnimatedPercentProps,
  UseAnimatedNumberOptions,
} from './AnimatedNumber';

// Animation components
export {
  AnimatedValue,
  BounceIn,
  FadeUp,
  GlowPulse,
  InteractiveCard,
  ScaleIn,
  SkeletonPulse,
  SlideIn,
  StaggeredList,
} from './Animations';
export type {
  AnimatedValueProps,
  BounceInProps,
  FadeUpProps,
  GlowPulseProps,
  InteractiveCardProps,
  ScaleInProps,
  SkeletonPulseProps,
  SlideInProps,
  StaggeredListProps,
  SlideDirection,
} from './Animations';

// Badge
export { Badge, badgeVariants } from './Badge';
export type { BadgeProps } from './Badge';

// Button
export { Button, buttonVariants } from './Button';
export type { ButtonProps } from './Button';

// Card
export { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle, CardAction } from './Card';

// Collapsible
export { Collapsible, CollapsibleContent, CollapsibleTrigger, CollapsiblePrimitive } from './Collapsible';
export type { CollapsibleRootProps, CollapsibleTriggerProps, CollapsibleContentProps } from './Collapsible';

// Dialog
export {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogOverlay,
  DialogPortal,
  DialogRoot,
  DialogTitle,
  DialogTrigger,
} from './Dialog';
export type {
  DialogCloseProps,
  DialogContentProps,
  DialogDescriptionProps,
  DialogFooterProps,
  DialogHeaderProps,
  DialogOverlayProps,
  DialogPortalProps,
  DialogRootProps,
  DialogTitleProps,
  DialogTriggerProps,
} from './Dialog';

// DropdownMenu
export {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuPortal,
  DropdownMenuPrimitive,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from './DropdownMenu';
export type {
  DropdownMenuCheckboxItemProps,
  DropdownMenuContentProps,
  DropdownMenuGroupLabelProps,
  DropdownMenuGroupProps,
  DropdownMenuItemProps,
  DropdownMenuPortalProps,
  DropdownMenuRadioGroupProps,
  DropdownMenuRadioItemProps,
  DropdownMenuRootProps,
  DropdownMenuSeparatorProps,
  DropdownMenuShortcutProps,
  DropdownMenuSubContentProps,
  DropdownMenuSubProps,
  DropdownMenuSubTriggerProps,
  DropdownMenuTriggerProps,
} from './DropdownMenu';

// Form layout components (UI/UX Law compliant)
export {
  FormActions,
  FormDivider,
  FormHeader,
  FormInfoSection,
  FormInputSection,
  FormLayout,
  FormOutputSection,
  FormRow,
} from './FormLayout';
export type { FormLayoutProps, FormSectionProps, FormHeaderProps, FormRowProps } from './FormLayout';

// GasEstimate
export { GasEstimate } from './GasEstimate';
export type { GasEstimateProps } from './GasEstimate';

// HoverCard
export {
  HoverCard,
  HoverCardArrow,
  HoverCardContent,
  HoverCardPortal,
  HoverCardPrimitive,
  HoverCardTrigger,
} from './HoverCard';
export type {
  HoverCardArrowProps,
  HoverCardContentProps,
  HoverCardPortalProps,
  HoverCardRootProps,
  HoverCardTriggerProps,
} from './HoverCard';

// Input
export {
  FormInput,
  Input,
  NumberInput,
  TextField,
  TextFieldDescription,
  TextFieldErrorMessage,
  TextFieldLabel,
  TextFieldRoot,
} from './Input';
export type {
  FormInputProps,
  InputProps,
  NumberInputProps,
  TextFieldDescriptionProps,
  TextFieldErrorMessageProps,
  TextFieldLabelProps,
  TextFieldRootProps,
} from './Input';

// Label
export { Label } from './Label';
export type { LabelProps } from './Label';

// Near-expiry warning component
export { NearExpiryWarning } from './NearExpiryWarning';
export type {
  ExpiryThreshold,
  NearExpiryWarningProps,
  Severity as ExpirySeverity,
} from './NearExpiryWarning';

// Progress
export {
  Progress,
  ProgressIndicator,
  ProgressLabel,
  ProgressPrimitive,
  ProgressTrack,
  ProgressValue,
} from './Progress';
export type {
  ProgressIndicatorProps,
  ProgressLabelProps,
  ProgressRootProps,
  ProgressTrackProps,
  ProgressValueLabelProps,
} from './Progress';

// Select
export {
  Select,
  SelectContent,
  SelectDescription,
  SelectErrorMessage,
  SelectItem,
  SelectLabel,
  SelectRoot,
  SelectSection,
  SelectTrigger,
  SelectValue,
} from './Select';
export type {
  SelectContentProps,
  SelectDescriptionProps,
  SelectErrorMessageProps,
  SelectItemProps,
  SelectLabelProps,
  SelectRootProps,
  SelectSectionProps,
  SelectTriggerProps,
  SelectValueProps,
} from './Select';

// Separator
export { Separator, SeparatorPrimitive } from './Separator';
export type { SeparatorProps } from './Separator';

// Skeleton
export {
  ChartSkeleton,
  FormSkeleton,
  HeroSkeleton,
  ListSkeleton,
  MarketCardSkeleton,
  Skeleton,
  SkeletonCard,
  SkeletonGrid,
  SparklineSkeleton,
  StatCardSkeleton,
  TableSkeleton,
} from './Skeleton';
export type {
  ChartSkeletonProps,
  FormSkeletonProps,
  HeroSkeletonProps,
  ListSkeletonProps,
  MarketCardSkeletonProps,
  SkeletonCardProps,
  SkeletonGridProps,
  SkeletonProps,
  SparklineSkeletonProps,
  StatCardSkeletonProps,
  TableSkeletonProps,
} from './Skeleton';

// Slider
export { Slider, SliderPrimitive } from './Slider';
export type { SliderRootProps } from './Slider';

// Sparkline and mini-chart components
export {
  ArrowDownIcon,
  ArrowUpIcon,
  MinusIcon,
  MiniBarChart,
  Sparkline,
  SparklineStat,
  SparklineWithValue,
  TrendIndicator,
} from './Sparkline';
export type {
  MiniBarChartProps,
  SparklineDataPoint,
  SparklineProps,
  SparklineStatProps,
  SparklineWithValueProps,
  TrendIndicatorProps,
} from './Sparkline';

// StatCard
export { StatCard, StatCardGrid } from './StatCard';
export type { StatCardGridProps, StatCardProps } from './StatCard';

// Step progress components for multi-step flows
export { StepCounter, StepIndicator, StepProgress } from './StepProgress';
export type { Step, StepCounterProps, StepIndicatorProps, StepProgressProps } from './StepProgress';

// Switch
export { Switch, SwitchPrimitive } from './Switch';
export type { SwitchProps } from './Switch';

// Tabs
export { Tabs, TabsContent, TabsIndicator, TabsList, tabsListVariants, TabsRoot, TabsTrigger } from './Tabs';
export type {
  TabsContentProps,
  TabsIndicatorProps,
  TabsListProps,
  TabsRootProps,
  TabsTriggerProps,
} from './Tabs';

// Toast
export {
  CircleCheckIcon,
  InfoIcon,
  Loader2Icon,
  OctagonXIcon,
  Toast,
  ToastCloseButton,
  ToastDescription,
  ToastIcon,
  ToastProgressFill,
  ToastProgressTrack,
  ToastRoot,
  ToastTitle,
  toastVariants,
  TriangleAlertIcon,
} from './Toast';
export type {
  ToastCloseButtonProps,
  ToastDescriptionProps,
  ToastProgressFillProps,
  ToastProgressTrackProps,
  ToastRootProps,
  ToastTitleProps,
  ToastVariant,
} from './Toast';

// Toaster
export { Toaster, toast } from './Toaster';
export type { ToasterProps } from './Toaster';

// Toggle
export { Toggle, toggleVariants, TogglePrimitive } from './Toggle';
export type { ToggleProps } from './Toggle';

// ToggleGroup
export { ToggleGroup, ToggleGroupContext, ToggleGroupItem } from './ToggleGroup';
export type { ToggleGroupContextValue, ToggleGroupItemProps, ToggleGroupProps } from './ToggleGroup';

// Typography components
export {
  AddressDisplay,
  ApyMetric,
  DataText,
  Display,
  GradientText,
  Heading,
  LabelText,
  Metric,
  StatDisplay,
} from './Typography';
export type {
  AddressDisplayProps,
  ApyMetricProps,
  DataTextProps,
  DisplayProps,
  GradientTextProps,
  HeadingProps,
  LabelTextProps,
  MetricProps,
  StatDisplayProps,
} from './Typography';
