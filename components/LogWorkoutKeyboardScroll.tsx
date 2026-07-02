import {
  createContext,
  forwardRef,
  useCallback,
  useContext,
  useEffect,
  useImperativeHandle,
  useRef,
  type ComponentProps,
  type RefObject,
} from 'react';
import { Keyboard, Platform, type ScrollView, type TextInput } from 'react-native';

import { NumericTextInput } from '@/components/NumericTextInput';
import { scrollInputAboveKeyboard } from '@/lib/scrollInputAboveKeyboard';

const STICKY_FOOTER_HEIGHT = 96;

type LogWorkoutKeyboardScrollContextValue = {
  scrollFocusedInputIntoView: (inputRef: RefObject<TextInput | null>) => void;
  onScroll: (event: { nativeEvent: { contentOffset: { y: number } } }) => void;
};

const LogWorkoutKeyboardScrollContext = createContext<LogWorkoutKeyboardScrollContextValue | null>(null);

export type LogWorkoutKeyboardScrollHandle = {
  onScroll: LogWorkoutKeyboardScrollContextValue['onScroll'];
};

export function useLogWorkoutKeyboardScrollOptional() {
  return useContext(LogWorkoutKeyboardScrollContext);
}

function useLogWorkoutKeyboardScrollContext(): LogWorkoutKeyboardScrollContextValue {
  const value = useContext(LogWorkoutKeyboardScrollContext);
  if (!value) {
    throw new Error('LogWorkout keyboard scroll hooks must be used within LogWorkoutKeyboardScrollProvider');
  }
  return value;
}

export const LogWorkoutKeyboardScrollProvider = forwardRef<
  LogWorkoutKeyboardScrollHandle,
  {
    scrollRef: RefObject<ScrollView | null>;
    children: React.ReactNode;
  }
>(function LogWorkoutKeyboardScrollProvider({ scrollRef, children }, ref) {
  const scrollYRef = useRef(0);
  const keyboardHeightRef = useRef(0);
  const lastFocusedInputRef = useRef<RefObject<TextInput | null> | null>(null);

  const attemptScroll = useCallback(
    (inputRef: RefObject<TextInput | null>) => {
      scrollInputAboveKeyboard({
        scrollRef,
        scrollYRef,
        inputRef,
        keyboardHeight: keyboardHeightRef.current,
        stickyFooterHeight: STICKY_FOOTER_HEIGHT,
      });
    },
    [scrollRef],
  );

  const scrollFocusedInputIntoView = useCallback(
    (inputRef: RefObject<TextInput | null>) => {
      lastFocusedInputRef.current = inputRef;
      attemptScroll(inputRef);
    },
    [attemptScroll],
  );

  useEffect(() => {
    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';

    const showSubscription = Keyboard.addListener(showEvent, (event) => {
      keyboardHeightRef.current = event.endCoordinates.height;
      if (lastFocusedInputRef.current) {
        attemptScroll(lastFocusedInputRef.current);
      }
    });

    const hideSubscription = Keyboard.addListener(hideEvent, () => {
      keyboardHeightRef.current = 0;
    });

    return () => {
      showSubscription.remove();
      hideSubscription.remove();
    };
  }, [attemptScroll]);

  const onScroll = useCallback((event: { nativeEvent: { contentOffset: { y: number } } }) => {
    scrollYRef.current = event.nativeEvent.contentOffset.y;
  }, []);

  useImperativeHandle(ref, () => ({ onScroll }), [onScroll]);

  return (
    <LogWorkoutKeyboardScrollContext.Provider value={{ scrollFocusedInputIntoView, onScroll }}>
      {children}
    </LogWorkoutKeyboardScrollContext.Provider>
  );
});

export function useLogWorkoutDurationInputFocusHandler(
  inputRef: RefObject<TextInput | null>,
  onFocus?: ComponentProps<typeof NumericTextInput>['onFocus'],
) {
  const { scrollFocusedInputIntoView } = useLogWorkoutKeyboardScrollContext();

  return (event: Parameters<NonNullable<ComponentProps<typeof NumericTextInput>['onFocus']>>[0]) => {
    onFocus?.(event);
    scrollFocusedInputIntoView(inputRef);
    requestAnimationFrame(() => {
      scrollFocusedInputIntoView(inputRef);
    });
  };
}

export function LogWorkoutNumericInput(props: ComponentProps<typeof NumericTextInput>) {
  const inputRef = useRef<TextInput>(null);
  const handleFocus = useLogWorkoutDurationInputFocusHandler(inputRef, props.onFocus);

  return <NumericTextInput {...props} ref={inputRef} onFocus={handleFocus} />;
}
