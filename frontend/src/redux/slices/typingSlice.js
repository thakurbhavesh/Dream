import { createSlice } from '@reduxjs/toolkit';

const typingSlice = createSlice({
    name: 'typing',
    initialState: {
        isTyping: false,
        typingUserId: null, // Track which user is typing
    },
    reducers: {
        setTyping(state, action) {
            state.isTyping = action.payload.isTyping;
            state.typingUserId = action.payload.userId || null;
        },
    },
});

export const { setTyping } = typingSlice.actions;
export default typingSlice.reducer;