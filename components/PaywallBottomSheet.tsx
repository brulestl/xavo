import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Modal, Dimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../contexts/AuthContext';

interface PaywallBottomSheetProps {
  visible: boolean;
  onClose: () => void;
}

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

export default function PaywallBottomSheet({ visible, onClose }: PaywallBottomSheetProps) {
  const { subscribePower } = useAuth();

  const handleUpgrade = async () => {
    try {
      await subscribePower();
      onClose();
    } catch (error) {
      console.error('Upgrade failed:', error);
    }
  };

  const valueProps = [
    {
      icon: 'infinite' as const,
      title: 'Unlimited Queries',
      description: 'Ask as many questions as you need without daily limits'
    },
    {
      icon: 'mic' as const,
      title: 'Voice Input',
      description: 'Speak your questions naturally with voice recognition'
    },
    {
      icon: 'analytics' as const,
      title: 'Deep Context Analysis',
      description: 'Advanced AI understanding of your relationship dynamics'
    },
    {
      icon: 'person' as const,
      title: 'Full Personalization',
      description: 'Tailored advice based on your unique situation and history'
    },
    {
      icon: 'shield-checkmark' as const,
      title: 'Priority Support',
      description: 'Get faster responses and premium customer support'
    }
  ];

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <TouchableOpacity 
          style={styles.backdrop} 
          activeOpacity={1} 
          onPress={onClose}
        />
        <View style={styles.bottomSheet}>
          <View style={styles.handle} />
          
          <View style={styles.header}>
            <TouchableOpacity style={styles.closeButton} onPress={onClose}>
              <Ionicons name="close" size={24} color="#666" />
            </TouchableOpacity>
          </View>

          <View style={styles.content}>
            <Text style={styles.title}>Unlock Power Strategist</Text>
            <Text style={styles.subtitle}>
              Take your relationship coaching to the next level
            </Text>

            <View style={styles.valuePropsContainer}>
              {valueProps.map((prop, index) => (
                <View key={index} style={styles.valueProp}>
                  <View style={styles.iconContainer}>
                    <Ionicons name={prop.icon} size={24} color="#023047" />
                  </View>
                  <View style={styles.propContent}>
                    <Text style={styles.propTitle}>{prop.title}</Text>
                    <Text style={styles.propDescription}>{prop.description}</Text>
                  </View>
                </View>
              ))}
            </View>

            <View style={styles.pricing}>
              <Text style={styles.price}>$30/month</Text>
              <Text style={styles.priceNote}>Cancel anytime</Text>
            </View>

            <TouchableOpacity style={styles.upgradeButton} onPress={handleUpgrade}>
              <Text style={styles.upgradeButtonText}>Upgrade for $30/month</Text>
            </TouchableOpacity>

            <Text style={styles.disclaimer}>
              Billed monthly. Cancel anytime in your account settings.
            </Text>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  backdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  bottomSheet: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: SCREEN_HEIGHT * 0.85,
    paddingBottom: 34, // Safe area padding for iPhone
  },
  handle: {
    width: 36,
    height: 4,
    backgroundColor: '#ddd',
    borderRadius: 2,
    alignSelf: 'center',
    marginTop: 12,
    marginBottom: 8,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    paddingHorizontal: 20,
    paddingBottom: 10,
  },
  closeButton: {
    padding: 4,
  },
  content: {
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#333',
    textAlign: 'center',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    marginBottom: 32,
  },
  valuePropsContainer: {
    marginBottom: 32,
  },
  valueProp: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 20,
  },
  iconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#02304722',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16,
  },
  propContent: {
    flex: 1,
  },
  propTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 4,
  },
  propDescription: {
    fontSize: 14,
    color: '#666',
    lineHeight: 20,
  },
  pricing: {
    alignItems: 'center',
    marginBottom: 24,
  },
  price: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#023047',
    marginBottom: 4,
  },
  priceNote: {
    fontSize: 14,
    color: '#666',
  },
  upgradeButton: {
    backgroundColor: '#023047',
    borderRadius: 12,
    padding: 18,
    alignItems: 'center',
    marginBottom: 16,
  },
  upgradeButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
  },
  disclaimer: {
    fontSize: 12,
    color: '#999',
    textAlign: 'center',
    lineHeight: 16,
  },
}); 