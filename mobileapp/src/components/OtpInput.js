import { useRef, useState } from 'react';
import { View, TextInput, StyleSheet, Dimensions } from 'react-native';

const OTP_LENGTH = 6;
const { width } = Dimensions.get('window');
const BOX_SIZE = Math.min(48, (width - 80) / OTP_LENGTH - 8);

export default function OtpInput({ value, onChange }) {
  const inputs = useRef([]);
  const [focused, setFocused] = useState(-1);
  const digits = (value || '').split('').concat(Array(OTP_LENGTH).fill('')).slice(0, OTP_LENGTH);

  const handleChange = (text, index) => {
    const cleaned = text.replace(/[^0-9]/g, '');
    if (cleaned.length === OTP_LENGTH) {
      onChange(cleaned);
      inputs.current[OTP_LENGTH - 1]?.blur();
      return;
    }
    const newDigits = [...digits];
    newDigits[index] = cleaned.slice(-1);
    onChange(newDigits.join(''));
    if (cleaned && index < OTP_LENGTH - 1) inputs.current[index + 1]?.focus();
  };

  const handleKeyPress = (e, index) => {
    if (e.nativeEvent.key === 'Backspace' && !digits[index] && index > 0) {
      inputs.current[index - 1]?.focus();
      const d = [...digits]; d[index - 1] = ''; onChange(d.join(''));
    }
  };

  return (
    <View style={styles.row}>
      {digits.map((digit, i) => (
        <TextInput
          key={i}
          ref={r => (inputs.current[i] = r)}
          style={[
            styles.box,
            focused === i && styles.boxFocus,
            digit && styles.boxFilled,
          ]}
          value={digit}
          onChangeText={t => handleChange(t, i)}
          onKeyPress={e => handleKeyPress(e, i)}
          onFocus={() => setFocused(i)}
          onBlur={() => setFocused(-1)}
          keyboardType="number-pad"
          maxLength={i === 0 ? OTP_LENGTH : 1}
          textContentType="oneTimeCode"
          autoComplete="one-time-code"
          selectTextOnFocus
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', justifyContent: 'center', gap: 10 },
  box: {
    width: BOX_SIZE,
    height: BOX_SIZE + 8,
    borderRadius: 14,
    borderWidth: 2,
    borderColor: '#e2e8f0',
    backgroundColor: '#fafbfc',
    textAlign: 'center',
    fontSize: 22,
    fontWeight: '800',
    color: '#0f172a',
  },
  boxFocus: {
    borderColor: '#ea4c89',
    backgroundColor: '#eef2ff',
    shadowColor: '#ea4c89',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 3,
  },
  boxFilled: { borderColor: '#ea4c89', backgroundColor: '#fff' },
});
