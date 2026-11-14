package com.wdiscute.starcatcher.lib.multiblock.components;

import com.wdiscute.starcatcher.Starcatcher;
import net.minecraft.world.level.block.state.properties.Property;

import java.util.ArrayList;
import java.util.List;

public class SharedStatePropertiesBuilder {
    private final List<PropertyWrapper<?>> PROPERTIES = new ArrayList<>();
    private boolean isInitialized = false;

    public <T extends Comparable<T>> void add(Property<T> property){
        if (isInitialized) {
            Starcatcher.LOGGER.error("Tried to add a new synced BlockStateProperty, but SyncedStatePropertiesBuilder was already initialized");
            return;
        }

        this.PROPERTIES.add(PropertyWrapper.addProperty(property));
    }

    public List<PropertyWrapper<?>> getProperties(){
        return PROPERTIES;
    }

    public boolean isInitialized() {
        return isInitialized;
    }

    public void setInitialized(){
        this.isInitialized = true;
    }
}
