import React, { memo, useEffect, useState } from 'react';
import { TextInput, TouchableOpacity, View } from 'react-native';
import { Card } from './Card';
import { Lucide } from './Icon';
import { Radius } from '../theme';
import { useDebouncedValue } from '../hooks/useDebouncedValue';

interface MapSearchBarProps {
  placeholder: string;
  /** Fires with the debounced query — the parent re-renders per debounce, not per keystroke. */
  onDebouncedChange: (query: string) => void;
  searchBarStyle: any;
  searchInputStyle: any;
  placeholderColor: string;
  iconColor: string;
}

/**
 * Owns the search TextInput state so keystrokes re-render only this small
 * component (T041) — the map screen (markers, list, sheet) sees nothing
 * until the debounce settles.
 */
function MapSearchBarImpl({
  placeholder,
  onDebouncedChange,
  searchBarStyle,
  searchInputStyle,
  placeholderColor,
  iconColor,
}: MapSearchBarProps) {
  const [query, setQuery] = useState('');
  const debounced = useDebouncedValue(query, 150);

  useEffect(() => {
    onDebouncedChange(debounced);
  }, [debounced, onDebouncedChange]);

  return (
    <Card shadow="sm" borderRadius={Radius.md} style={{ flex: 1 }}>
      <View style={searchBarStyle}>
        <Lucide name="search" size={16} color={iconColor} />
        <TextInput
          style={searchInputStyle}
          placeholder={placeholder}
          placeholderTextColor={placeholderColor}
          value={query}
          onChangeText={setQuery}
          returnKeyType="search"
        />
        {query.length > 0 && (
          <TouchableOpacity onPress={() => setQuery('')} hitSlop={8} testID="search-clear">
            <Lucide name="x" size={16} color={iconColor} />
          </TouchableOpacity>
        )}
      </View>
    </Card>
  );
}

export const MapSearchBar = memo(MapSearchBarImpl);
