"use client";

import React, { useState, useEffect, useRef } from 'react';
import { Crosshair } from 'lucide-react';

/**
 * Floating pill navbar for Ballistic Workstation.
 * Props:
 *   phase    — current app phase (number)
 *   navItems — array of { label, ph, disabled, onClick }
 */
const AnimatedNavLink = ({ children, active, disabled, onClick }) => (
  <button
    disabled={disabled}
    onClick={disabled ? undefined : onClick}
    className={[
      'group relative inline-flex items-center overflow-hidden h-5 text-sm cursor-pointer bg-transparent border-none p-0',
      disabled ? 'opacity-30 cursor-not-allowed' : '',
    ].join(' ')}>
    <div className="flex flex-col transition-transform duration-300 ease-out transform group-hover:-translate-y-1/2">
      <span className={active ? 'text-primary font-semibold' : 'text-gray-400'}>{children}</span>
      <span className={active ? 'text-primary font-semibold' : 'text-white'}>{children}</span>
    </div>
  </button>
);

export function Navbar({ phase, navItems = [] }) {
  const [isOpen, setIsOpen] = useState(false);
  const [shapeClass, setShapeClass] = useState('rounded-full');
  const timerRef = useRef(null);

  useEffect(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    if (isOpen) {
      setShapeClass('rounded-xl');
    } else {
      timerRef.current = setTimeout(() => setShapeClass('rounded-full'), 300);
    }
    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  }, [isOpen]);

  return (
    <header className={[
      'fixed top-6 left-1/2 -translate-x-1/2 z-20 flex flex-col items-center',
      'pl-5 pr-5 py-3 backdrop-blur-sm',
      shapeClass,
      'border border-[#333] bg-[#1f1f1f57]',
      'w-[calc(100%-2rem)] sm:w-auto',
      'transition-[border-radius] duration-300',
    ].join(' ')}>
      <div className="flex items-center justify-between w-full gap-x-6">
        {/* Brand mark */}
        <div className="flex items-center gap-1.5 shrink-0">
          <Crosshair size={14} className="text-primary" strokeWidth={2} />
          <span className="text-primary font-bold text-[11px] tracking-[0.12em] uppercase hidden sm:block">
            Ballistic WS
          </span>
        </div>

        {/* Nav links — desktop */}
        <nav className="hidden sm:flex items-center space-x-5 text-sm">
          {navItems.map(item => (
            <AnimatedNavLink
              key={item.label}
              active={phase === item.ph}
              disabled={item.disabled}
              onClick={item.onClick}>
              {item.label}
            </AnimatedNavLink>
          ))}
        </nav>

        {/* Mobile toggle */}
        <button
          className="sm:hidden flex items-center justify-center w-8 h-8 text-gray-300 focus:outline-none cursor-pointer bg-transparent border-none"
          onClick={() => setIsOpen(o => !o)}
          aria-label={isOpen ? 'Close menu' : 'Open menu'}>
          {isOpen ? (
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          ) : (
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          )}
        </button>
      </div>

      {/* Mobile dropdown */}
      <div className={[
        'sm:hidden flex flex-col items-center w-full transition-all ease-in-out duration-300 overflow-hidden',
        isOpen ? 'max-h-[500px] opacity-100 pt-4' : 'max-h-0 opacity-0 pt-0 pointer-events-none',
      ].join(' ')}>
        <nav className="flex flex-col items-center space-y-3 w-full">
          {navItems.map(item => (
            <button
              key={item.label}
              disabled={item.disabled}
              onClick={() => { if (!item.disabled && item.onClick) { item.onClick(); setIsOpen(false); } }}
              className={[
                'text-sm w-full text-center transition-colors cursor-pointer bg-transparent border-none py-1',
                item.disabled ? 'text-gray-600 cursor-not-allowed' : phase === item.ph ? 'text-primary font-semibold' : 'text-gray-300 hover:text-white',
              ].join(' ')}>
              {item.label}
            </button>
          ))}
        </nav>
      </div>
    </header>
  );
}
