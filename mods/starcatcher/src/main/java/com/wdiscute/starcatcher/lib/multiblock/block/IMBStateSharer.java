package com.wdiscute.starcatcher.lib.multiblock.block;

import com.wdiscute.starcatcher.lib.multiblock.components.PropertyWrapper;
import com.wdiscute.starcatcher.lib.multiblock.components.SharedStatePropertiesBuilder;
import net.minecraft.core.BlockPos;
import net.minecraft.world.level.Level;
import net.minecraft.world.level.block.state.BlockState;
import net.minecraft.world.level.block.state.properties.DirectionProperty;

import java.util.ArrayList;
import java.util.List;

import static com.wdiscute.starcatcher.lib.multiblock.block.IMultiBlock.getCenter;
import static com.wdiscute.starcatcher.lib.multiblock.block.IMultiBlock.getFullShape;
import static com.wdiscute.starcatcher.lib.multiblock.block.IMultiBlock.isCenter;

public interface IMBStateSharer {

    SharedStatePropertiesBuilder getSharedStatePropertiesBuilder();

    default List<PropertyWrapper<?>> getSharedStateProperties(){
        SharedStatePropertiesBuilder sharedStatePropertiesBuilder = getSharedStatePropertiesBuilder();

        if (!sharedStatePropertiesBuilder.isInitialized()){
            createSharedBlockStates(sharedStatePropertiesBuilder);

            sharedStatePropertiesBuilder.setInitialized();
        }

        return sharedStatePropertiesBuilder.getProperties();
    }

    default void createSharedBlockStates(SharedStatePropertiesBuilder builder){
        DirectionProperty directionProperty = getMultiBlock().getDirectionProperty();
        if (directionProperty != null){
            builder.add(directionProperty);
        }
    }

    static void setBlockStates(Level level, BlockPos pos, List<PropertyWrapper<?>> properties){
        getFullShape(level, pos).forEach(pos1 -> {
            BlockState state = level.getBlockState(pos1);

            for (PropertyWrapper<?> propertyWrapper : properties) {
                state = propertyWrapper.applyTo(state);
            }

            level.setBlock(pos1, state, 3);
        });
    }

    default void shareBlockStates(Level level, BlockPos pos, BlockState state){
        List<PropertyWrapper<?>> list = new ArrayList<>(getSharedStateProperties());

        BlockPos centerPos = getCenter(level, pos);
        BlockState centerState = level.getBlockState(centerPos);
        boolean isCenter = isCenter(state);

        for (PropertyWrapper<?> propertyWrapper : list) {
            propertyWrapper.captureValue(state);

            if (!isCenter) {
                centerState = propertyWrapper.applyTo(centerState);
            }
        }

        if (!isCenter){
            level.setBlock(centerPos, centerState, 2);
            return;
        }

        setBlockStates(level, pos, list);
    }

    private IMultiBlock getMultiBlock(){
        if (this instanceof IMultiBlock block){
            return block;
        } else {
            throw new RuntimeException(this.getClass().getSimpleName() + " is not implemented on an IMultiBlock");
        }
    }
}
