import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

let registered = false;

/** GSAP + ScrollTrigger bir marta ro‘yxatdan o‘tkaziladi (faqat kerak bo‘lgan sahifalarda import qilinadi). */
export function getGsap() {
  if (!registered) {
    gsap.registerPlugin(ScrollTrigger);
    registered = true;
  }
  return { gsap, ScrollTrigger };
}
