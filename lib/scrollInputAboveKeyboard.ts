import { Dimensions, type RefObject } from 'react-native';
import type { ScrollView, TextInput } from 'react-native';

type ScrollInputAboveKeyboardOptions = {
  scrollRef: RefObject<ScrollView | null>;
  scrollYRef: RefObject<number>;
  inputRef: RefObject<TextInput | null>;
  keyboardHeight: number;
  stickyFooterHeight: number;
  extraPadding?: number;
};

export function scrollInputAboveKeyboard({
  scrollRef,
  scrollYRef,
  inputRef,
  keyboardHeight,
  stickyFooterHeight,
  extraPadding = 16,
}: ScrollInputAboveKeyboardOptions): void {
  const input = inputRef.current;
  const scrollView = scrollRef.current;

  if (!input || !scrollView || keyboardHeight <= 0) {
    return;
  }

  input.measureInWindow((_x, inputY, _width, inputHeight) => {
    const windowHeight = Dimensions.get('window').height;
    const visibleBottom = windowHeight - keyboardHeight - stickyFooterHeight;
    const inputBottom = inputY + inputHeight;
    const overlap = inputBottom + extraPadding - visibleBottom;

    if (overlap > 0) {
      scrollView.scrollTo({
        y: scrollYRef.current + overlap,
        animated: true,
      });
    }
  });
}
