import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

export default class ErrorBoundary extends React.Component {
  state = { hasError: false, error: null };

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('[ErrorBoundary]', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <View style={s.root}>
          <View style={s.icon}><Ionicons name="warning" size={40} color="#f59e0b" /></View>
          <Text style={s.title}>Something went wrong</Text>
          <Text style={s.sub}>The app encountered an unexpected error</Text>
          <TouchableOpacity style={s.btn} onPress={() => this.setState({ hasError: false, error: null })} activeOpacity={0.8}>
            <Ionicons name="refresh" size={18} color="#fff" />
            <Text style={s.btnText}>Try Again</Text>
          </TouchableOpacity>
        </View>
      );
    }
    return this.props.children;
  }
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#0f172a', alignItems: 'center', justifyContent: 'center', padding: 30 },
  icon: { width: 72, height: 72, borderRadius: 36, backgroundColor: '#f59e0b15', alignItems: 'center', justifyContent: 'center', marginBottom: 20 },
  title: { fontSize: 20, fontWeight: '800', color: '#f1f5f9', marginBottom: 8 },
  sub: { fontSize: 14, color: '#64748b', textAlign: 'center', marginBottom: 24 },
  btn: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#3b82f6', paddingHorizontal: 24, paddingVertical: 14, borderRadius: 14 },
  btnText: { fontSize: 15, fontWeight: '700', color: '#fff' },
});
