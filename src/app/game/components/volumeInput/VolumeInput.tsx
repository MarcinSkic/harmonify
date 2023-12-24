import {
    mdiVolumeHigh,
    mdiVolumeLow,
    mdiVolumeMedium,
    mdiVolumeOff,
} from "@mdi/js";
import Icon from "@mdi/react";
import React, { useState } from "react";
import styles from "./volumeInput.module.scss";

function getVolumeIcon(volume: number) {
    if (volume === 0) {
        return mdiVolumeOff;
    } else if (volume < 25) {
        return mdiVolumeLow;
    } else if (volume < 75) {
        return mdiVolumeMedium;
    } else {
        return mdiVolumeHigh;
    }
}

export default function VolumeInput({
    style,
    defaultValue,
    onChange,
}: {
    style?: React.CSSProperties;
    defaultValue: number;
    onChange: (v: number) => void;
}) {
    const [icon, setIcon] = useState(() => getVolumeIcon(defaultValue));

    return (
        <div style={style} className={styles["volume-input"]}>
            <Icon path={icon} className={styles["volume-input__icon"]} />
            <div className={styles["volume-input__input"]}>
                <input
                    className={styles["volume-input__input__inside"]}
                    type="range"
                    min={0}
                    max={100}
                    step={1}
                    defaultValue={defaultValue}
                    onChange={(e) => {
                        const value = Number.parseInt(e.target.value);

                        onChange(value);
                        setIcon(getVolumeIcon(value));
                    }}
                />
            </div>
        </div>
    );
}
