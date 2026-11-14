package com.wdiscute.starcatcher.lib.multiblock.components;

import net.minecraft.util.FastColor;

public enum PreviewMode {
    PREVIEW(0.5f,1f,1f,1f),
    ENTITY_BLOCKED(0.5f,1f,0.8f,0.4f),
    INVALID(0.5f,0.8f,0.3f,0.3f);

    public final float alpha;
    public final float red;
    public final float green;
    public final float blue;

    PreviewMode(float alpha, float red, float green, float blue) {
        this.alpha = alpha;
        this.red = red;
        this.green = green;
        this.blue = blue;
    }

    public int applyColors(int originalColor){
        float r = FastColor.ARGB32.red(originalColor);
        float g = FastColor.ARGB32.green(originalColor);
        float b = FastColor.ARGB32.blue(originalColor);
        float a = FastColor.ARGB32.alpha(originalColor);

        r = r * red;
        g = g * green;
        b = b * blue;
        a = a * alpha;

        return FastColor.ARGB32.color((int) a, (int) r, (int) g, (int) b);
    }
}
