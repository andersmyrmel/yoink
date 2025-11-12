/**
 * Layout Component Extractors
 *
 * Extracts high-level layout components like sidebar, topbar, and navigation menus.
 * These are structural components that define the overall page layout.
 */

import { getCachedComputedStyle } from '../../utils/domCache';
import { isVisible } from '../../utils/domFilters';
import { ComponentVariant } from '../../types/extraction';

/**
 * Extracts sidebar components
 */
export function extractSidebars(): ComponentVariant[] {
  const sidebars: ComponentVariant[] = [];

  const sidebarSelectors = [
    'aside:not([aria-hidden="true"])',
    '[role="complementary"]:not([aria-hidden="true"])',
    'nav[class*="sidebar"]:not([aria-hidden="true"])',
    'nav[class*="side"]:not([aria-hidden="true"])',
    '[class*="sidebar"]:not([aria-hidden="true"])'
  ];

  for (const selector of sidebarSelectors) {
    const elements = document.querySelectorAll(selector);

    elements.forEach(el => {
      if (!isVisible(el)) return;

      const rect = el.getBoundingClientRect();
      const styles = getCachedComputedStyle(el);

      // Get actual dimensions
      const computedWidth = parseFloat(styles.width);
      const computedHeight = parseFloat(styles.height);
      const actualWidth = computedWidth > 0 ? computedWidth : rect.width;
      const actualHeight = computedHeight > 0 ? computedHeight : rect.height;

      // Validate it's sidebar-like
      if (actualWidth > 50 && actualWidth < 600 && actualHeight > 100) {
        const position = styles.position;
        const isFixed = position === 'fixed' || position === 'sticky' || position === 'absolute';

        // Determine what's inside
        const hasNav = !!el.querySelector('nav, [role="navigation"]');
        const hasButtons = !!el.querySelector('button, [role="button"]');
        const hasLinks = !!el.querySelector('a[href]');

        // Build semantic description
        let description = '';
        if (isFixed) {
          description = 'Fixed ';
        }
        if (hasNav || hasLinks) {
          description += 'navigation sidebar';
        } else if (hasButtons) {
          description += 'action sidebar';
        } else {
          description += 'sidebar panel';
        }

        // Check for collapsible behavior
        const isCollapsible = el.hasAttribute('aria-expanded') ||
                             el.querySelector('[aria-expanded]') ||
                             String(el.className || '').includes('collaps');

        if (isCollapsible) {
          description += ' with collapse functionality';
        }

        sidebars.push({
          variant: 'sidebar',
          count: 1,
          html: `<aside class="${el.className || 'sidebar'}">...</aside>`,
          classes: String(el.className || 'sidebar'),
          description,
          styles: {
            width: `${Math.round(actualWidth)}px`,
            height: `${Math.round(actualHeight)}px`,
            position: styles.position,
            background: styles.backgroundColor,
            border: styles.borderRight || styles.border,
            zIndex: styles.zIndex !== 'auto' ? styles.zIndex : undefined
          }
        });
      }
    });
  }

  return sidebars;
}

/**
 * Extracts topbar/header components
 */
export function extractTopbars(): ComponentVariant[] {
  const topbars: ComponentVariant[] = [];

  const topbarSelectors = [
    'header:not([aria-hidden="true"])',
    '[role="banner"]:not([aria-hidden="true"])',
    '[class*="topbar"]:not([aria-hidden="true"])',
    '[class*="header"]:not([aria-hidden="true"])',
    '[class*="navbar"]:not([aria-hidden="true"])'
  ];

  for (const selector of topbarSelectors) {
    const elements = document.querySelectorAll(selector);

    elements.forEach(el => {
      if (!isVisible(el)) return;

      const rect = el.getBoundingClientRect();
      const styles = getCachedComputedStyle(el);

      // Get actual dimensions
      const computedHeight = parseFloat(styles.height);
      const actualHeight = computedHeight > 0 ? computedHeight : rect.height;

      // Validate it's topbar-like
      if (rect.top < 150 && rect.width > window.innerWidth * 0.4 && actualHeight > 20 && actualHeight < 300) {
        const position = styles.position;
        const isFixed = position === 'fixed' || position === 'sticky';

        // Determine what's inside
        const hasNav = !!el.querySelector('nav, [role="navigation"]');
        const hasSearch = !!el.querySelector('input[type="search"], [class*="search"]');
        const hasActions = !!el.querySelector('button, [role="button"]');
        const hasLogo = !!el.querySelector('[class*="logo"], img[alt*="logo" i]');

        // Build semantic description
        let description = '';
        if (isFixed) {
          description = 'Fixed ';
        }

        const features: string[] = [];
        if (hasLogo) features.push('branding');
        if (hasNav) features.push('navigation');
        if (hasSearch) features.push('search');
        if (hasActions) features.push('actions');

        if (features.length > 0) {
          description += `application toolbar with ${features.join(', ')}`;
        } else {
          description += 'header bar';
        }

        topbars.push({
          variant: 'topbar',
          count: 1,
          html: `<header class="${el.className || 'topbar'}">...</header>`,
          classes: String(el.className || 'topbar'),
          description,
          styles: {
            height: `${Math.round(actualHeight)}px`,
            width: '100%',
            position: styles.position,
            background: styles.backgroundColor,
            border: styles.borderBottom || styles.border,
            boxShadow: styles.boxShadow !== 'none' ? styles.boxShadow : undefined,
            zIndex: styles.zIndex !== 'auto' ? styles.zIndex : undefined
          }
        });
      }
    });
  }

  return topbars;
}

/**
 * Extracts main navigation menu components
 */
export function extractNavigationMenus(): ComponentVariant[] {
  const menus: ComponentVariant[] = [];

  const menuSelectors = [
    'nav:not([class*="sidebar"]):not([aria-hidden="true"])',
    '[role="navigation"]:not([class*="sidebar"]):not([aria-hidden="true"])'
  ];

  for (const selector of menuSelectors) {
    const elements = document.querySelectorAll(selector);

    elements.forEach(el => {
      if (!isVisible(el)) return;

      const styles = getCachedComputedStyle(el);

      // Skip if this is part of sidebar (already captured)
      const inSidebar = el.closest('[class*="sidebar"], aside');
      if (inSidebar) return;

      // Determine orientation
      const display = styles.display;
      const flexDirection = styles.flexDirection;
      const isVertical = flexDirection === 'column' || display === 'block';
      const isHorizontal = flexDirection === 'row' || (display === 'flex' && flexDirection !== 'column');

      // Count menu items
      const menuItems = el.querySelectorAll('a, [role="menuitem"], [role="link"]');
      const itemCount = menuItems.length;

      if (itemCount === 0) return;

      // Build description
      let description = '';
      if (isHorizontal) {
        description = 'Horizontal navigation menu';
      } else if (isVertical) {
        description = 'Vertical navigation menu';
      } else {
        description = 'Navigation menu';
      }

      description += ` with ${itemCount} items`;

      // Check for dropdowns/submenus
      const hasDropdowns = !!el.querySelector('[role="menu"], [class*="dropdown"], [class*="submenu"]');
      if (hasDropdowns) {
        description += ' and dropdown submenus';
      }

      menus.push({
        variant: 'navigation-menu',
        count: 1,
        html: `<nav class="${el.className || 'nav'}">...</nav>`,
        classes: String(el.className || 'nav'),
        description,
        styles: {
          display: styles.display,
          gap: styles.gap !== 'normal' && styles.gap !== '0px' ? styles.gap : undefined,
          padding: styles.padding,
          background: styles.backgroundColor !== 'rgba(0, 0, 0, 0)' ? styles.backgroundColor : undefined,
          // flexDirection is stored as a custom property
          ...(styles.flexDirection !== 'row' ? { flexDirection: styles.flexDirection } : {})
        } as any
      });
    });
  }

  return menus;
}
