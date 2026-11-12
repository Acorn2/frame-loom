import React from 'react';
import {uiText, type UiLanguage} from './ui-text';

const UiLanguageContext = React.createContext<UiLanguage>('zh');

export const UiLanguageProvider = UiLanguageContext.Provider;

export function useUiText() {
  return uiText(React.useContext(UiLanguageContext));
}
