import { createSlice } from "@reduxjs/toolkit";

// ----------------------------------------------------------------------
import { dispatch } from "../store";

const initialState = {
    sidebar: {
        open: false,
        type: "CONTACT", //can be CONTACT , STARRED, SHARED
    }
}

const slice = createSlice({
    name: 'app',
    initialState,
    reducers: {
        // toggle sidebar
        toggleSidebar(state, action) {
            state.sidebar.open = !state.sidebar.open;
        },
        setSidebarOpen(state, action) {
            state.sidebar.open = action.payload === true;
        },
        updateSidebarType(state, action) {
            state.sidebar.type = action.payload.type;
        },
        openSidebar(state, action) {
            state.sidebar.open = true;
            if (action.payload?.type) {
                state.sidebar.type = action.payload.type;
            }
        }
    }
})

// reducer 
export default slice.reducer;


export function toggleSidebar() {
    return async () => {
        dispatch(slice.actions.toggleSidebar())
    }
}

export function closeSidebar() {
    return (dispatch, getState) => {
      const state = getState();
      const isOpen = state?.app?.sidebar?.open;
      if (isOpen) {
        dispatch(slice.actions.setSidebarOpen(false));
      }
    };
  }
  

export function updateSidebarType(type) {
    return async () => {
        dispatch(
            slice.actions.updateSidebarType({
            type,
        }))
    }
}

export function openSidebar(type) {
    return async () => {
        dispatch(
            slice.actions.openSidebar({
            type,
        }))
    }
}
