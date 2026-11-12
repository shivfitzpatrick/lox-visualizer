import { ColorScheme, TokenCategory } from '@/lox-visualizer/state/token';

const baseColors = {
    white: '#f8f8f0',
    blue: '#56b5c2',
};

export const colors: ColorScheme = {
    background: '#242930',
    highlight: baseColors.blue,
    keyword: '#1abc9c',
    identifier: baseColors.white,
    paren: baseColors.white,
    literal: '#e74c3c',
};

export const weight: Partial<Record<TokenCategory, string>> = {
    identifier: 'bold',
};
