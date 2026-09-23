import { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { ping } from '../api';
import { signIn, signOut } from '../auth';
import { API_URL } from '../config';
import { colors } from '../theme';

interface Props {
  onSignedIn: (email: string) => void;
  /** Message à afficher en arrivant (ex. session refusée par le script) */
  initialError?: string | null;
}

/** Connexion avec le compte Google ; le script vérifie que le compte est autorisé. */
export function LoginScreen({ onSignedIn, initialError }: Props) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(initialError ?? null);

  const login = async () => {
    setBusy(true);
    setError(null);
    try {
      const email = await signIn();
      if (!email) return; // fenêtre Google fermée
      try {
        await ping({ url: API_URL, googleEmail: email });
      } catch (e) {
        await signOut();
        throw e;
      }
      onSignedIn(email);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.logo}>
        <Text style={styles.logoText}>✓</Text>
      </View>
      <Text style={styles.title}>Mes tâches</Text>
      <Text style={styles.subtitle}>Tâches, missions et rendez-vous, enregistrés dans votre Google Sheet.</Text>

      {error && <Text style={styles.error}>{error}</Text>}

      <Pressable
        style={({ pressed }) => [styles.button, pressed && styles.pressed, busy && styles.disabled]}
        onPress={login}
        disabled={busy}
        accessibilityRole="button"
      >
        {busy ? (
          <ActivityIndicator color={colors.text} />
        ) : (
          <>
            <Text style={styles.g}>G</Text>
            <Text style={styles.buttonText}>Se connecter avec Google</Text>
          </>
        )}
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', padding: 28 },
  logo: {
    width: 64,
    height: 64,
    borderRadius: 18,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  logoText: { color: '#fff', fontSize: 34, fontWeight: '700' },
  title: { fontSize: 30, fontWeight: '700', color: colors.text },
  subtitle: { marginTop: 8, fontSize: 16, lineHeight: 22, color: colors.muted },
  error: {
    marginTop: 24,
    color: colors.danger,
    backgroundColor: '#FCE8E6',
    padding: 12,
    borderRadius: 10,
    fontSize: 14,
    lineHeight: 20,
  },
  button: {
    marginTop: 32,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    paddingVertical: 15,
  },
  pressed: { backgroundColor: '#EEF1F6' },
  disabled: { opacity: 0.7 },
  g: { fontSize: 20, fontWeight: '700', color: colors.primary },
  buttonText: { fontSize: 16, fontWeight: '600', color: colors.text },
});
