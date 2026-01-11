# Styling Review: Horizon Protocol Website

## Homepage

I've analyzed the Horizon Protocol yield tokenization platform. Overall, it has a solid dark theme design with clean aesthetics, but there are several areas where the styling could be improved.

Current Strengths

Clean dark theme with good contrast between the background and text
Consistent orange accent color that creates brand identity
Well-organized navigation with clear hierarchy
Good use of cards to organize information in the stats and opportunities sections


Proposed Improvements
1. Typography & Visual Hierarchy
Issue: The hero headline "Earn Fixed Yield" uses a stylized font with exaggerated letter spacing that may hurt readability. The subtitle text appears somewhat washed out (low contrast gray).
Recommendations:

Tighten the letter-spacing on the hero headline for better readability
Increase the contrast of the subtitle text (currently around #7a7a7a) to at least #9a9a9a
Add more variation in font weights to create stronger visual hierarchy

2. Hero Section Layout
Issue: The hero section has a lot of vertical space with the stat circles feeling disconnected from the CTA buttons.
Recommendations:

Add a subtle background visual element (gradient mesh, abstract shapes) to add depth
Consider repositioning the stat circles closer to the headline to create a more cohesive unit
Add subtle animation on the stat circles (e.g., a gentle pulse or count-up animation)

3. Stats Cards Section
Issue: The four stats cards (Total TVL, 24H Volume, 24H Swaps, 24H Fees) are visually flat and the icons are barely visible. The "0" values feel empty.
Recommendations:

Add a subtle border or hover effect to the cards
Make the icons more prominent with a slightly larger size and better opacity
Consider adding placeholder states for zero values (e.g., "—" or skeleton loading states)
Add subtle gradient backgrounds to differentiate cards

4. "Earning Opportunities" Card
Issue: The market card is well-designed but the right side of the page is completely empty, creating an unbalanced layout.
Recommendations:

Consider a grid layout if more markets are expected
Add a placeholder or illustration on the right side if only one market exists
The "68d left" badge could use a more distinct styling (perhaps with a countdown feel)

5. "What you can do" Section
Issue: The cards lack visual interest—they're plain dark rectangles with minimal styling.
Recommendations:

Add hover animations (subtle lift, border glow, or background color shift)
Include icons or illustrations to make each card more visually engaging
Add arrow indicators to show these are clickable links
Consider adding a subtle gradient or pattern to the card backgrounds

6. Footer Design
Issue: The footer is functional but visually monotonous with all links appearing identical.
Recommendations:

Add hover states to footer links (color change, underline)
Consider adding social media icons
Add visual separation between footer columns (subtle dividers or more spacing)
The "Built on Starknet" could be more prominent with a Starknet logo

7. Overall Polish
Additional recommendations:

Add micro-interactions: button hover states, card transitions, link underline animations
Consider adding a subtle scrolling animation when sections come into view (fade-in or slide-up)
The "Simple/Advanced" toggle could have a more obvious selected state
Add a subtle box-shadow to the navigation bar to separate it from content when scrolling


Color Palette Refinement
The current palette is essentially black (#000) with orange (#FF6B00 approximate). Consider:

Adding a secondary accent color for variety (perhaps a teal or blue for informational elements)
Using slightly warm grays instead of pure neutral grays for a softer feel
Adding gradient variations of the orange for buttons and highlights

Detailed CSS Recommendations for Horizon Protocol
Based on my earlier review, here are specific CSS implementations for each improvement:

1. Typography & Contrast Improvements
css/* Hero subtitle - increase contrast */
.hero-subtitle {
  color: #b0b0b0; /* was approximately #7a7a7a */
  font-size: 1.25rem;
  line-height: 1.6;
  max-width: 600px;
  margin: 0 auto;
}

/* Hero headline - tighter letter spacing */
.hero-headline {
  letter-spacing: -0.02em; /* tighten from the current wide spacing */
  font-weight: 600;
}

/* Better text hierarchy with varied weights */
.section-title {
  font-weight: 700;
  color: #ffffff;
}

.card-title {
  font-weight: 600;
  color: #f0f0f0;
}

.card-description {
  font-weight: 400;
  color: #9a9a9a;
}

2. Hero Stat Circles Enhancement
css/* Animated stat circles */
.stat-circle {
  position: relative;
  width: 120px;
  height: 120px;
  border-radius: 50%;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  background: rgba(255, 255, 255, 0.03);
  border: 2px solid rgba(255, 255, 255, 0.1);
  transition: all 0.3s ease;
}

.stat-circle:hover {
  transform: translateY(-4px);
  border-color: rgba(255, 107, 0, 0.4);
  box-shadow: 0 8px 32px rgba(255, 107, 0, 0.15);
}

/* Highlighted stat (APY) with orange border */
.stat-circle--highlight {
  border-color: #ff6b00;
  box-shadow: 0 0 24px rgba(255, 107, 0, 0.25);
}

/* Pulse animation for key stats */
@keyframes subtle-pulse {
  0%, 100% { box-shadow: 0 0 24px rgba(255, 107, 0, 0.25); }
  50% { box-shadow: 0 0 32px rgba(255, 107, 0, 0.4); }
}

.stat-circle--highlight {
  animation: subtle-pulse 3s ease-in-out infinite;
}

3. Stats Cards Improvements
css/* Enhanced stat cards */
.stats-card {
  background: linear-gradient(
    145deg,
    rgba(255, 255, 255, 0.05) 0%,
    rgba(255, 255, 255, 0.02) 100%
  );
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 12px;
  padding: 24px;
  transition: all 0.3s ease;
}

.stats-card:hover {
  border-color: rgba(255, 107, 0, 0.3);
  background: linear-gradient(
    145deg,
    rgba(255, 255, 255, 0.07) 0%,
    rgba(255, 255, 255, 0.03) 100%
  );
  transform: translateY(-2px);
}

/* More visible icons */
.stats-card-icon {
  opacity: 0.6; /* was likely lower */
  color: #ff6b00;
  font-size: 1.25rem;
  transition: opacity 0.3s ease;
}

.stats-card:hover .stats-card-icon {
  opacity: 1;
}

/* Empty state styling */
.stats-value--empty {
  color: #4a4a4a;
  font-style: italic;
}

.stats-value--empty::before {
  content: "—";
}

4. "What You Can Do" Cards
css/* Feature cards with hover effects */
.feature-card {
  background: rgba(255, 255, 255, 0.03);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 16px;
  padding: 32px;
  position: relative;
  overflow: hidden;
  transition: all 0.4s cubic-bezier(0.4, 0, 0.2, 1);
}

/* Subtle gradient overlay on hover */
.feature-card::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: linear-gradient(
    135deg,
    rgba(255, 107, 0, 0.1) 0%,
    transparent 60%
  );
  opacity: 0;
  transition: opacity 0.4s ease;
}

.feature-card:hover {
  border-color: rgba(255, 107, 0, 0.4);
  transform: translateY(-4px);
  box-shadow: 0 12px 40px rgba(0, 0, 0, 0.3);
}

.feature-card:hover::before {
  opacity: 1;
}

/* Arrow indicator */
.feature-card-arrow {
  position: absolute;
  right: 24px;
  top: 50%;
  transform: translateY(-50%) translateX(-8px);
  opacity: 0;
  color: #ff6b00;
  font-size: 1.5rem;
  transition: all 0.3s ease;
}

.feature-card:hover .feature-card-arrow {
  opacity: 1;
  transform: translateY(-50%) translateX(0);
}

5. Button Improvements
css/* Primary button (orange filled) */
.btn-primary {
  background: linear-gradient(135deg, #ff6b00 0%, #ff8533 100%);
  color: #000;
  font-weight: 600;
  padding: 14px 32px;
  border-radius: 8px;
  border: none;
  cursor: pointer;
  position: relative;
  overflow: hidden;
  transition: all 0.3s ease;
}

.btn-primary::before {
  content: '';
  position: absolute;
  top: 0;
  left: -100%;
  width: 100%;
  height: 100%;
  background: linear-gradient(
    90deg,
    transparent,
    rgba(255, 255, 255, 0.2),
    transparent
  );
  transition: left 0.5s ease;
}

.btn-primary:hover {
  transform: translateY(-2px);
  box-shadow: 0 8px 24px rgba(255, 107, 0, 0.4);
}

.btn-primary:hover::before {
  left: 100%;
}

/* Secondary button (outline) */
.btn-secondary {
  background: transparent;
  color: #fff;
  font-weight: 500;
  padding: 14px 32px;
  border-radius: 8px;
  border: 1px solid rgba(255, 255, 255, 0.3);
  cursor: pointer;
  transition: all 0.3s ease;
}

.btn-secondary:hover {
  border-color: #ff6b00;
  color: #ff6b00;
  background: rgba(255, 107, 0, 0.1);
}

6. Market Opportunity Card
css/* Market card enhancement */
.market-card {
  background: linear-gradient(
    180deg,
    rgba(40, 40, 40, 0.8) 0%,
    rgba(25, 25, 25, 0.9) 100%
  );
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 16px;
  padding: 24px;
  transition: all 0.3s ease;
}

.market-card:hover {
  border-color: rgba(255, 107, 0, 0.3);
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.4);
}

/* Time remaining badge */
.badge-time {
  background: linear-gradient(135deg, #ff6b00 0%, #ff8533 100%);
  color: #000;
  font-weight: 600;
  font-size: 0.75rem;
  padding: 4px 12px;
  border-radius: 20px;
  display: inline-flex;
  align-items: center;
  gap: 4px;
}

/* Inner stat boxes */
.market-stat-box {
  background: rgba(0, 0, 0, 0.3);
  border-radius: 8px;
  padding: 16px;
  border: 1px solid rgba(255, 255, 255, 0.05);
}

/* APY highlight */
.apy-value {
  color: #ff6b00;
  font-size: 2rem;
  font-weight: 700;
  text-shadow: 0 0 20px rgba(255, 107, 0, 0.3);
}

7. Footer Enhancements
css/* Footer links */
.footer-link {
  color: #888;
  text-decoration: none;
  position: relative;
  transition: color 0.3s ease;
}

.footer-link::after {
  content: '';
  position: absolute;
  bottom: -2px;
  left: 0;
  width: 0;
  height: 1px;
  background: #ff6b00;
  transition: width 0.3s ease;
}

.footer-link:hover {
  color: #fff;
}

.footer-link:hover::after {
  width: 100%;
}

/* Footer section headers */
.footer-heading {
  color: #fff;
  font-weight: 600;
  margin-bottom: 16px;
  font-size: 0.875rem;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

/* "Built on Starknet" styling */
.powered-by {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  color: #888;
  transition: color 0.3s ease;
}

.powered-by:hover {
  color: #ff6b00;
}

.powered-by-logo {
  width: 20px;
  height: 20px;
  opacity: 0.7;
  transition: opacity 0.3s ease;
}

.powered-by:hover .powered-by-logo {
  opacity: 1;
}

8. Navigation Polish
css/* Sticky nav with shadow on scroll */
.nav {
  position: sticky;
  top: 0;
  z-index: 100;
  background: rgba(0, 0, 0, 0.95);
  backdrop-filter: blur(10px);
  transition: box-shadow 0.3s ease;
}

.nav--scrolled {
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.5);
}

/* Nav link hover states */
.nav-link {
  color: #888;
  text-decoration: none;
  padding: 8px 16px;
  position: relative;
  transition: color 0.3s ease;
}

.nav-link::after {
  content: '';
  position: absolute;
  bottom: 0;
  left: 50%;
  width: 0;
  height: 2px;
  background: #ff6b00;
  transform: translateX(-50%);
  transition: width 0.3s ease;
}

.nav-link:hover,
.nav-link--active {
  color: #fff;
}

.nav-link--active::after {
  width: 100%;
}

/* Simple/Advanced toggle */
.mode-toggle {
  background: rgba(255, 255, 255, 0.1);
  border-radius: 20px;
  padding: 4px;
  display: flex;
  gap: 4px;
}

.mode-toggle-option {
  padding: 6px 16px;
  border-radius: 16px;
  font-size: 0.875rem;
  cursor: pointer;
  transition: all 0.3s ease;
  color: #888;
}

.mode-toggle-option--active {
  background: #ff6b00;
  color: #000;
  font-weight: 600;
}

9. Scroll Animations (Optional Enhancement)
css/* Fade-in animation for sections */
@keyframes fade-in-up {
  from {
    opacity: 0;
    transform: translateY(20px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.animate-on-scroll {
  opacity: 0;
}

.animate-on-scroll.is-visible {
  animation: fade-in-up 0.6s ease forwards;
}

/* Stagger children animations */
.animate-on-scroll.is-visible > *:nth-child(1) { animation-delay: 0.1s; }
.animate-on-scroll.is-visible > *:nth-child(2) { animation-delay: 0.2s; }
.animate-on-scroll.is-visible > *:nth-child(3) { animation-delay: 0.3s; }
.animate-on-scroll.is-visible > *:nth-child(4) { animation-delay: 0.4s; }

These CSS recommendations maintain the existing dark theme and orange accent color while adding depth, interactivity, and polish. The transitions are kept subtle (0.3s ease is the standard) to feel professional without being distracting. Would you like me to provide any additional details, such as responsive breakpoints or accessibility considerations?
 
 
 Styling Review: Horizon Protocol /mint Page (Earn Fixed Yield)
 I've analyzed the Earn Fixed Yield page. This is a functional DeFi interface with a clean layout, but there are several opportunities to improve visual hierarchy, user feedback, and overall polish.
 
 Current Strengths
 
 Two-column layout effectively separates the action panel (left) from educational content (right)
 Clear information architecture with deposit/withdraw tabs and step-by-step guide
 Consistent brand colors (orange accent) maintained from homepage
 Good use of numbered steps in "How Earning Works" section
 
 
 General Recommendations
 1. Page Header Area
 Issue: The page header with "Earn Fixed Yield" duplicates the card header below. The "Back" link is understated and the icon beside the title feels disconnected.
 Recommendations:
 
 Remove the duplicate "Earn Fixed Yield" heading inside the card (or vice versa)
 Make the "Back" link more prominent with an actual back arrow icon and hover state
 Add subtle animation to the orange icon or make it more integrated with the heading
 
 2. Asset Selector Dropdown
 Issue: The dropdown looks functional but flat. The chevron is barely visible and there's no visual indication this is an important selection.
 Recommendations:
 
 Add a subtle border or glow when focused
 Make the dropdown arrow more prominent
 Consider adding the token icon (if available) inline
 Add hover state with background color change
 
 3. Deposit/Withdraw Tab Toggle
 Issue: The tab toggle has the selected state (Deposit) in dark gray, which doesn't clearly communicate the active state. The inactive tab (Withdraw) looks nearly identical.
 Recommendations:
 
 Make the active tab more prominent (orange background or white text with underline)
 Add a clear visual distinction between active/inactive states
 Consider a sliding indicator animation when switching tabs
 
 4. Input Field Design
 Issue: The deposit input area is functional but visually flat. The "MAX" button lacks a clear clickable affordance. The token badge (hrzSTRK) looks like a static label.
 Recommendations:
 
 Add focus states with border color change (orange glow)
 Make the "MAX" button look more interactive (underline, different color on hover)
 Increase the size of the input text for better readability
 Add a subtle inner shadow to the input container for depth
 
 5. Output Preview Section ("You'll receive")
 Issue: The "You'll receive" section lacks visual hierarchy. The two position types look like plain text rather than important output values.
 Recommendations:
 
 Add subtle card backgrounds to each position row
 Use color coding (orange for fixed-rate, different color for variable-rate)
 Add icons to differentiate position types
 Make the values more prominent (larger font, bold)
 
 6. Rate Display Box
 Issue: The "Fixed Rate 7.64%" and "Matures on" box is good but could be more visually prominent as it contains key information.
 Recommendations:
 
 Add a subtle gradient border or glow effect
 Make the 7.64% larger and bolder
 Add a subtle animation or sparkle to draw attention to the rate
 
 7. "How Earning Works" Sidebar
 Issue: The sidebar is well-structured but visually static. The numbered steps blend together with low contrast.
 Recommendations:
 
 Add hover states to each step for better interactivity
 Make the step numbers more prominent (larger, with background)
 Add subtle connecting lines between steps
 Consider collapsible sections for advanced users
 
 8. Position Types Table
 Issue: The position types section at the bottom of the sidebar looks like a data table but lacks structure.
 Recommendations:
 
 Add alternating row backgrounds or separators
 Add small icons for Fixed-Rate (lock icon) and Variable-Rate (chart icon)
 Improve text contrast for better readability
 
 9. Connect Wallet Button
 Issue: The main CTA button is positioned well but could be more prominent.
 Recommendations:
 
 Add a subtle pulsing animation or glow to attract attention
 Consider a loading state animation for when connecting
 Add micro-interaction on hover (slight scale up, shadow)
 
 
 Detailed CSS Recommendations
 1. Enhanced Asset Dropdown
 css/* Asset selector dropdown */
 .asset-dropdown {
   background: rgba(255, 255, 255, 0.05);
   border: 1px solid rgba(255, 255, 255, 0.1);
   border-radius: 12px;
   padding: 14px 16px;
   cursor: pointer;
   display: flex;
   align-items: center;
   justify-content: space-between;
   transition: all 0.3s ease;
 }
 
 .asset-dropdown:hover {
   border-color: rgba(255, 107, 0, 0.4);
   background: rgba(255, 255, 255, 0.07);
 }
 
 .asset-dropdown:focus,
 .asset-dropdown[aria-expanded="true"] {
   border-color: #ff6b00;
   box-shadow: 0 0 0 3px rgba(255, 107, 0, 0.15);
   outline: none;
 }
 
 /* Dropdown chevron */
 .asset-dropdown-chevron {
   color: #888;
   font-size: 1rem;
   transition: transform 0.3s ease, color 0.3s ease;
 }
 
 .asset-dropdown:hover .asset-dropdown-chevron {
   color: #ff6b00;
 }
 
 .asset-dropdown[aria-expanded="true"] .asset-dropdown-chevron {
   transform: rotate(180deg);
   color: #ff6b00;
 }
 
 /* Token icon (if applicable) */
 .asset-dropdown-token-icon {
   width: 24px;
   height: 24px;
   border-radius: 50%;
   margin-right: 12px;
   background: linear-gradient(135deg, #ff6b00 0%, #ff8533 100%);
 }
 2. Improved Tab Toggle
 css/* Tab container */
 .tab-container {
   background: rgba(255, 255, 255, 0.05);
   border-radius: 12px;
   padding: 4px;
   display: flex;
   position: relative;
 }
 
 /* Sliding indicator */
 .tab-container::before {
   content: '';
   position: absolute;
   top: 4px;
   left: 4px;
   width: calc(50% - 4px);
   height: calc(100% - 8px);
   background: #ff6b00;
   border-radius: 8px;
   transition: transform 0.3s cubic-bezier(0.4, 0, 0.2, 1);
   z-index: 0;
 }
 
 .tab-container[data-active="withdraw"]::before {
   transform: translateX(100%);
 }
 
 /* Tab buttons */
 .tab-button {
   flex: 1;
   padding: 12px 24px;
   border: none;
   background: transparent;
   color: #888;
   font-weight: 500;
   font-size: 0.9375rem;
   cursor: pointer;
   position: relative;
   z-index: 1;
   transition: color 0.3s ease;
 }
 
 .tab-button--active {
   color: #000;
   font-weight: 600;
 }
 
 .tab-button:hover:not(.tab-button--active) {
   color: #fff;
 }
 3. Enhanced Input Field
 css/* Input container */
 .input-container {
   background: rgba(0, 0, 0, 0.3);
   border: 1px solid rgba(255, 255, 255, 0.08);
   border-radius: 12px;
   padding: 16px 20px;
   transition: all 0.3s ease;
 }
 
 .input-container:hover {
   border-color: rgba(255, 255, 255, 0.15);
 }
 
 .input-container:focus-within {
   border-color: #ff6b00;
   box-shadow: 0 0 0 3px rgba(255, 107, 0, 0.1),
               inset 0 2px 4px rgba(0, 0, 0, 0.2);
 }
 
 /* Input label row */
 .input-label-row {
   display: flex;
   justify-content: space-between;
   align-items: center;
   margin-bottom: 8px;
 }
 
 .input-label {
   color: #888;
   font-size: 0.875rem;
 }
 
 /* MAX button */
 .max-button {
   background: transparent;
   border: none;
   color: #888;
   font-size: 0.875rem;
   cursor: pointer;
   display: flex;
   align-items: center;
   gap: 4px;
   padding: 4px 8px;
   border-radius: 6px;
   transition: all 0.2s ease;
 }
 
 .max-button:hover {
   background: rgba(255, 107, 0, 0.1);
   color: #ff6b00;
 }
 
 .max-button .max-label {
   font-weight: 600;
   color: #ff6b00;
 }
 
 /* Main input */
 .deposit-input {
   background: transparent;
   border: none;
   color: #fff;
   font-size: 2rem;
   font-weight: 600;
   font-family: 'JetBrains Mono', monospace;
   width: 100%;
   outline: none;
 }
 
 .deposit-input::placeholder {
   color: #444;
 }
 
 /* Token badge */
 .token-badge {
   background: rgba(255, 255, 255, 0.1);
   color: #aaa;
   padding: 8px 14px;
   border-radius: 8px;
   font-size: 0.875rem;
   font-weight: 500;
   display: flex;
   align-items: center;
   gap: 6px;
 }
 
 .token-badge-icon {
   width: 18px;
   height: 18px;
   border-radius: 50%;
 }
 4. Output Preview Section
 css/* You'll receive container */
 .receive-container {
   background: rgba(0, 0, 0, 0.2);
   border-radius: 12px;
   padding: 20px;
   margin-top: 16px;
 }
 
 .receive-header {
   color: #888;
   font-size: 0.875rem;
   margin-bottom: 16px;
 }
 
 /* Position rows */
 .position-row {
   display: flex;
   justify-content: space-between;
   align-items: center;
   padding: 12px 16px;
   background: rgba(255, 255, 255, 0.03);
   border-radius: 8px;
   margin-bottom: 8px;
   border-left: 3px solid transparent;
   transition: all 0.3s ease;
 }
 
 .position-row:hover {
   background: rgba(255, 255, 255, 0.05);
 }
 
 /* Fixed-rate position styling */
 .position-row--fixed {
   border-left-color: #ff6b00;
 }
 
 .position-row--fixed .position-label::before {
   content: '🔒';
   margin-right: 8px;
   font-size: 0.875rem;
 }
 
 /* Variable-rate position styling */
 .position-row--variable {
   border-left-color: #4ecdc4; /* teal accent for variety */
 }
 
 .position-row--variable .position-label::before {
   content: '📈';
   margin-right:
