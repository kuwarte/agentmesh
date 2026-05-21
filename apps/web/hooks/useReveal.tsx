'use client'

import { useEffect, useRef } from 'react'

interface UseRevealOptions {
  threshold?: number
  delay?: number
  once?: boolean
}

/**
 * useReveal
 * Attaches IntersectionObserver to a ref.
 * Adds data-revealed="true" when element enters viewport.
 * CSS animates on [data-revealed="true"].
 */
export function useReveal<T extends HTMLElement = HTMLElement>(
  options: UseRevealOptions = {}
) {
  const { threshold = 0.12, delay = 0, once = true } = options
  const ref = useRef<T>(null)

  useEffect(() => {
    const el = ref.current
    if (!el) return

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          const apply = () => el.setAttribute('data-revealed', 'true')
          delay > 0 ? setTimeout(apply, delay) : apply()
          if (once) observer.disconnect()
        } else if (!once) {
          el.removeAttribute('data-revealed')
        }
      },
      { threshold }
    )

    observer.observe(el)
    return () => observer.disconnect()
  }, [threshold, delay, once])

  return ref
}

/**
 * useRevealChildren
 * Staggered reveal — adds data-revealed="true" to each child
 * with an increasing delay when the container enters viewport.
 */
export function useRevealChildren<T extends HTMLElement = HTMLElement>(
  options: UseRevealOptions & { stagger?: number; childSelector?: string } = {}
) {
  const { threshold = 0.1, delay = 0, once = true, stagger = 80, childSelector } = options
  const ref = useRef<T>(null)

  useEffect(() => {
    const container = ref.current
    if (!container) return

    const children = Array.from(
      childSelector
        ? container.querySelectorAll<HTMLElement>(childSelector)
        : (container.children as HTMLCollectionOf<HTMLElement>)
    )

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          children.forEach((child, i) => {
            setTimeout(
              () => child.setAttribute('data-revealed', 'true'),
              delay + i * stagger
            )
          })
          if (once) observer.disconnect()
        } else if (!once) {
          children.forEach(child => child.removeAttribute('data-revealed'))
        }
      },
      { threshold }
    )

    observer.observe(container)
    return () => observer.disconnect()
  }, [threshold, delay, once, stagger, childSelector])

  return ref
}