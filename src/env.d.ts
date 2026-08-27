/// <reference types="astro/client" />

import "react";

declare module "react" {
  interface FormHTMLAttributes<_T> {
    toolname?: string;
    tooldescription?: string;
    toolautosubmit?: boolean;
  }

  interface InputHTMLAttributes<_T> {
    toolparamdescription?: string;
  }

  interface TextareaHTMLAttributes<_T> {
    toolparamdescription?: string;
  }
}
