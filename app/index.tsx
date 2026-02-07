import { Link } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';

export default function HomeScreen() {
    return (
        <View style={styles.container}>
            <Text style={styles.title}>Welcome to Form Check Agent</Text>
            <Text style={styles.subtitle}>Improve your form with AI analysis.</Text>

            <Link href="/form-check" style={styles.link}>
                <Text style={styles.linkText}>Start Analysis</Text>
            </Link>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#fff',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 20,
    },
    title: {
        fontSize: 24,
        fontWeight: 'bold',
        marginBottom: 10,
    },
    subtitle: {
        fontSize: 16,
        color: '#666',
        marginBottom: 20,
    },
    link: {
        marginTop: 20,
        padding: 15,
        backgroundColor: '#007AFF',
        borderRadius: 8,
    },
    linkText: {
        color: '#fff',
        fontSize: 16,
        fontWeight: '600',
    },
});
