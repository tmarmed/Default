import { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { ping } from '../api';
import { colors } from '../theme';
import type { Settings } from '../types';

interface Props {
  initial: Settings | null;
  onSaved: (settings: Settings) => void;
  onCancel?: () => void;
  onDisconnect?: () => void;
}

/** Connexion au Google Sheet : URL de l'application Web Apps Script + clé d'accès. */
export function SettingsScreen({ initial, onSaved, onCancel, onDisconnect }: Props) {
  const [url, setUrl] = useState(initial?.url ?? '');
  const [key, setKey] = useState(initial?.key ?? '');
  const [busy, setBusy] = useState(false);

  const connect = async () => {
    const settings = { url: url.trim(), key: key.trim() };
    if (!/^https:\/\/script\.google\.com\/.+\/exec$/.test(settings.url)) {
      Alert.alert('URL invalide', "L'URL doit commencer par https://script.google.com/ et finir par /exec.");
      return;
    }
    if (!settings.key) {
      Alert.alert('Clé manquante', "Saisissez la clé d'accès affichée par la fonction « installer ».");
      return;
    }
    setBusy(true);
    try {
      await ping(settings);
      onSaved(settings);
    } catch (e) {
      Alert.alert('Connexion impossible', (e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Text style={styles.title}>Connexion au Google Sheet</Text>
        <Text style={styles.help}>
          Dans votre Google Sheet : Extensions › Apps Script, collez le fichier Code.gs, lancez « installer »
          puis Déployer › Nouveau déploiement › Application Web (accès : Tout le monde). Copiez ici l'URL
          obtenue et la clé d'accès affichée dans le journal.
        </Text>

        <Text style={styles.label}>URL de l'application Web</Text>
        <TextInput
          style={styles.input}
          value={url}
          onChangeText={setUrl}
          placeholder="https://script.google.com/macros/s/…/exec"
          placeholderTextColor={colors.muted}
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="url"
        />

        <Text style={styles.label}>Clé d'accès</Text>
        <TextInput
          style={styles.input}
          value={key}
          onChangeText={setKey}
          placeholder="Clé générée par le script"
          placeholderTextColor={colors.muted}
          autoCapitalize="none"
          autoCorrect={false}
          secureTextEntry
        />

        <Pressable style={[styles.button, busy && styles.disabled]} onPress={connect} disabled={busy}>
          {busy ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Se connecter</Text>}
        </Pressable>

        <View style={styles.links}>
          {onCancel && (
            <Pressable onPress={onCancel} hitSlop={10}>
              <Text style={styles.link}>Annuler</Text>
            </Pressable>
          )}
          {onDisconnect && (
            <Pressable
              onPress={() =>
                Alert.alert('Se déconnecter ?', "Les réglages et la copie locale seront effacés de l'appareil.", [
                  { text: 'Annuler', style: 'cancel' },
                  { text: 'Déconnecter', style: 'destructive', onPress: onDisconnect },
                ])
              }
              hitSlop={10}
            >
              <Text style={[styles.link, { color: colors.danger }]}>Se déconnecter</Text>
            </Pressable>
          )}
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: { padding: 20, paddingTop: 32 },
  title: { fontSize: 24, fontWeight: '700', color: colors.text },
  help: { marginTop: 12, fontSize: 14, lineHeight: 20, color: colors.muted },
  label: { marginTop: 22, marginBottom: 8, fontSize: 13, fontWeight: '600', color: colors.muted },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 12,
    fontSize: 15,
    color: colors.text,
    backgroundColor: colors.card,
  },
  button: {
    marginTop: 28,
    backgroundColor: colors.primary,
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
  },
  disabled: { opacity: 0.6 },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  links: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 24 },
  link: { color: colors.primary, fontSize: 15 },
});
