import { StyleSheet, Text, View } from 'react-native';

export default function FormCheckScreen() {
    return (
        <View style={styles.container}>
            <Text style={styles.title}>Form Analysis</Text>
            <Text>Camera and analysis features will be implemented here.</Text>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#fff',
        alignItems: 'center',
        justifyContent: 'center',
    },
    title: {
        fontSize: 20,
        fontWeight: 'bold',
        marginBottom: 20,
    },
});
