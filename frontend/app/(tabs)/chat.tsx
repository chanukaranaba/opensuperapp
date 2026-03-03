// Copyright (c) 2025 WSO2 LLC. (https://www.wso2.com).
//
// WSO2 LLC. licenses this file to you under the Apache License,
// Version 2.0 (the "License"); you may not use this file except
// in compliance with the License.
// You may obtain a copy of the License at
//
// http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing,
// software distributed under the License is distributed on an
// "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
// KIND, either express or implied.  See the License for the
// specific language governing permissions and limitations
// under the License.
import { Colors } from "@/constants/Colors";
import { ScreenPaths } from "@/constants/ScreenPaths";
import { useTrackActiveScreen } from "@/hooks/useTrackActiveScreen";
import { sendChatMessage } from "@/services/chatService";
import { Ionicons } from "@expo/vector-icons";
import { useBottomTabBarHeight } from "@react-navigation/bottom-tabs";
import React, { useCallback, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  useColorScheme,
  View,
} from "react-native";
import Markdown from "react-native-markdown-display";


interface ChatMessage {
  id: string;
  text: string;
  role: "user" | "assistant";
  timestamp: number;
}

/**
 * Chat screen provides an AI-powered conversational interface.
 * Users can ask questions about workplace services (e.g., today's menu)
 * and the agent responds using micro-app backends.
 */
const ChatScreen = () => {
  const colorScheme = useColorScheme();
  const tabBarHeight = useBottomTabBarHeight();
  const styles = createStyles(colorScheme ?? "light");

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputText, setInputText] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const flatListRef = useRef<FlatList>(null);

  useTrackActiveScreen(ScreenPaths.CHAT);

  const addMessage = useCallback(
    (text: string, role: "user" | "assistant") => {
      const newMessage: ChatMessage = {
        id: `${Date.now()}-${role}`,
        text,
        role,
        timestamp: Date.now(),
      };
      setMessages((prev) => [...prev, newMessage]);
    },
    []
  );

  const handleSend = useCallback(async () => {
    const trimmed = inputText.trim();
    if (!trimmed || isLoading) return;

    addMessage(trimmed, "user");
    setInputText("");
    setIsLoading(true);

    try {
      const response = await sendChatMessage(trimmed);
      addMessage(response.reply, "assistant");
    } catch (error: any) {
      const errorMessage =
        error.response?.data?.detail ||
        error.message ||
        "Something went wrong. Please try again.";
      addMessage(`Sorry, I encountered an error: ${errorMessage}`, "assistant");
    } finally {
      setIsLoading(false);
    }
  }, [inputText, isLoading, addMessage]);

  const markdownStyles = useMemo(
    () => ({
      body: {
        fontSize: 15,
        lineHeight: 21,
        color:
          colorScheme === "dark"
            ? Colors.dark.primaryTextColor
            : Colors.light.primaryTextColor,
      },
      strong: {
        fontWeight: "700" as const,
      },
      paragraph: {
        marginTop: 2,
        marginBottom: 2,
      },
      bullet_list: {
        marginTop: 2,
        marginBottom: 2,
      },
      ordered_list: {
        marginTop: 2,
        marginBottom: 2,
      },
      list_item: {
        marginTop: 1,
        marginBottom: 1,
      },
    }),
    [colorScheme]
  );

  const renderMessage = useCallback(
    ({ item }: { item: ChatMessage }) => {
      const isUser = item.role === "user";
      return (
        <View
          style={[
            styles.messageBubble,
            isUser ? styles.userBubble : styles.assistantBubble,
          ]}
        >
          {!isUser && (
            <View style={styles.assistantIcon}>
              <Ionicons
                name="sparkles"
                size={16}
                color={Colors.companyOrange}
              />
            </View>
          )}
          {isUser ? (
            <Text style={[styles.messageText, styles.userText]}>
              {item.text}
            </Text>
          ) : (
            <Markdown style={markdownStyles}>{item.text}</Markdown>
          )}
        </View>
      );
    },
    [styles, markdownStyles]
  );

  return (
    <View style={styles.container}>
      <KeyboardAvoidingView
        style={styles.keyboardView}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        keyboardVerticalOffset={Platform.OS === "ios" ? tabBarHeight : 0}
      >
        {messages.length === 0 ? (
          <View style={styles.emptyState}>
            <Ionicons
              name="chatbubble-ellipses-outline"
              size={64}
              color={
                colorScheme === "dark"
                  ? Colors.dark.secondaryTextColor
                  : Colors.light.secondaryTextColor
              }
            />
            <Text style={styles.emptyTitle}>Hi there!</Text>
            <Text style={styles.emptySubtitle}>
              Ask me anything about your workplace.{"\n"}Try: "What's for lunch
              today?"
            </Text>
          </View>
        ) : (
          <FlatList
            ref={flatListRef}
            data={messages}
            renderItem={renderMessage}
            keyExtractor={(item) => item.id}
            style={styles.flatList}
            contentContainerStyle={styles.messageList}
            onContentSizeChange={() =>
              flatListRef.current?.scrollToEnd({ animated: true })
            }
          />
        )}

        {/* Typing Indicator */}
        {isLoading && (
          <View style={styles.typingContainer}>
            <Ionicons
              name="sparkles"
              size={14}
              color={Colors.companyOrange}
            />
            <Text style={styles.typingText}>Thinking...</Text>
          </View>
        )}

        {/* Input Bar */}
        <View style={[styles.inputContainer, { paddingBottom: 8 + tabBarHeight }]}>
          <TextInput
            style={styles.textInput}
            placeholder="Ask me anything..."
            placeholderTextColor={
              colorScheme === "dark"
                ? Colors.dark.secondaryTextColor
                : Colors.light.secondaryTextColor
            }
            value={inputText}
            onChangeText={setInputText}
            multiline
            maxLength={500}
            onSubmitEditing={handleSend}
            returnKeyType="send"
            editable={!isLoading}
          />
          <TouchableOpacity
            style={[
              styles.sendButton,
              (!inputText.trim() || isLoading) && styles.sendButtonDisabled,
            ]}
            onPress={handleSend}
            disabled={!inputText.trim() || isLoading}
            activeOpacity={0.7}
          >
            {isLoading ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <Ionicons name="arrow-up" size={20} color="#FFFFFF" />
            )}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </View>
  );
};

const createStyles = (colorScheme: "light" | "dark") => {
  const colors = Colors[colorScheme];

  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.primaryBackgroundColor,
    },
    keyboardView: {
      flex: 1,
    },

    // Empty state
    emptyState: {
      flex: 1,
      justifyContent: "center",
      alignItems: "center",
      paddingHorizontal: 40,
    },
    emptyTitle: {
      fontSize: 22,
      fontWeight: "700",
      color: colors.primaryTextColor,
      marginTop: 16,
    },
    emptySubtitle: {
      fontSize: 15,
      color: colors.secondaryTextColor,
      textAlign: "center",
      marginTop: 8,
      lineHeight: 22,
    },

    // Messages
    flatList: {
      flex: 1,
    },
    messageList: {
      paddingHorizontal: 16,
      paddingTop: 12,
      paddingBottom: 8,
    },
    messageBubble: {
      maxWidth: "80%",
      borderRadius: 16,
      paddingHorizontal: 14,
      paddingVertical: 10,
      marginBottom: 8,
    },
    userBubble: {
      alignSelf: "flex-end",
      backgroundColor: Colors.companyOrange,
      borderBottomRightRadius: 4,
    },
    assistantBubble: {
      alignSelf: "flex-start",
      backgroundColor: colors.secondaryBackgroundColor,
      borderBottomLeftRadius: 4,
    },
    assistantIcon: {
      marginBottom: 4,
    },
    messageText: {
      fontSize: 15,
      lineHeight: 21,
    },
    userText: {
      color: "#FFFFFF",
    },
    assistantText: {
      color: colors.primaryTextColor,
    },

    // Typing indicator
    typingContainer: {
      flexDirection: "row",
      alignItems: "center",
      paddingHorizontal: 20,
      paddingVertical: 6,
      gap: 6,
    },
    typingText: {
      fontSize: 13,
      color: colors.secondaryTextColor,
      fontStyle: "italic",
    },

    // Input
    inputContainer: {
      flexDirection: "row",
      alignItems: "flex-end",
      paddingHorizontal: 12,
      paddingVertical: 8,
      borderTopWidth: 1,
      borderTopColor: colors.borderColor,
      backgroundColor: colors.primaryBackgroundColor,
      gap: 8,
    },
    textInput: {
      flex: 1,
      minHeight: 40,
      maxHeight: 100,
      borderRadius: 20,
      paddingHorizontal: 16,
      paddingTop: 10,
      paddingBottom: 10,
      fontSize: 15,
      backgroundColor: colors.secondaryBackgroundColor,
      color: colors.primaryTextColor,
    },
    sendButton: {
      width: 36,
      height: 36,
      borderRadius: 18,
      backgroundColor: Colors.companyOrange,
      justifyContent: "center",
      alignItems: "center",
    },
    sendButtonDisabled: {
      opacity: 0.4,
    },
  });
};

export default ChatScreen;
