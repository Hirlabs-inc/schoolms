-- SQL script to add missing courses for Primary and Secondary classes

DO $$
DECLARE
    class_record RECORD;
    
    -- Primary Subjects (Grades 1-8)
    -- User list: Somali, Arabic, Islamic, Maths, Social, Science, English, Technology
    subjects_primary text[] := ARRAY['Somali', 'Arabic', 'Islamic', 'Maths', 'Social', 'Science', 'English', 'Technology'];
    codes_primary text[] := ARRAY['SOM', 'ARA', 'ISL', 'MATH', 'SOC', 'SCI', 'ENG', 'TECH'];
    
    -- Secondary Subjects (Grades 9-12)
    -- User list: Biology, Chemistry, Physics, Geography, History, Technology, Business, Maths, Arabic, Islamic, Somali, English
    subjects_secondary text[] := ARRAY['Biology', 'Chemistry', 'Physics', 'Geography', 'History', 'Technology', 'Business', 'Maths', 'Arabic', 'Islamic', 'Somali', 'English'];
    codes_secondary text[] := ARRAY['BIO', 'CHEM', 'PHY', 'GEO', 'HIST', 'TECH', 'BUS', 'MATH', 'ARA', 'ISL', 'SOM', 'ENG'];
    
    s_index integer;
BEGIN
    -- 1. Process Primary Classes (Grades 1-8)
    FOR class_record IN SELECT id, "gradeLevel" FROM classes WHERE "gradeLevel" BETWEEN 1 AND 8 LOOP
        FOR s_index IN 1..array_length(subjects_primary, 1) LOOP
            -- Check if course already exists for this class
            IF NOT EXISTS (
                SELECT 1 FROM courses 
                WHERE "classId" = class_record.id 
                AND (name = subjects_primary[s_index] OR name = 'Mathematics' AND subjects_primary[s_index] = 'Maths') -- Handle potential naming variation
            ) THEN
                INSERT INTO courses (id, name, code, "classId")
                VALUES (
                    uuid_generate_v4()::text,
                    subjects_primary[s_index],
                    codes_primary[s_index] || class_record."gradeLevel",
                    class_record.id
                );
                RAISE NOTICE 'Added Primary Course: % for Grade %', subjects_primary[s_index], class_record."gradeLevel";
            END IF;
        END LOOP;
    END LOOP;

    -- 2. Process Secondary Classes (Grades 9-12)
    FOR class_record IN SELECT id, "gradeLevel" FROM classes WHERE "gradeLevel" BETWEEN 9 AND 12 LOOP
        FOR s_index IN 1..array_length(subjects_secondary, 1) LOOP
            -- Check if course already exists for this class
            IF NOT EXISTS (
                SELECT 1 FROM courses 
                WHERE "classId" = class_record.id 
                AND (name = subjects_secondary[s_index] OR name = 'Mathematics' AND subjects_secondary[s_index] = 'Maths')
            ) THEN
                INSERT INTO courses (id, name, code, "classId")
                VALUES (
                    uuid_generate_v4()::text,
                    subjects_secondary[s_index],
                    codes_secondary[s_index] || class_record."gradeLevel",
                    class_record.id
                );
                RAISE NOTICE 'Added Secondary Course: % for Grade %', subjects_secondary[s_index], class_record."gradeLevel";
            END IF;
        END LOOP;
    END LOOP;
END $$;
