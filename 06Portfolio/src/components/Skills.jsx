import React from 'react';
import { 
  Typography, 
  Container, 
  Grid, 
  Card, 
  CardContent, 
  LinearProgress, 
  Box, 
  Chip,
  Avatar,
  IconButton
} from '@mui/material';
import { 
  Code as CodeIcon, 
  Storage as StorageIcon, 
  Build as BuildIcon,
  Star as StarIcon,
  TrendingUp as TrendingUpIcon
} from '@mui/icons-material';
import { motion } from 'framer-motion';

const Skills = () => {
  const skillCategories = [
    {
      title: 'Frontend Development',
      icon: <CodeIcon sx={{ fontSize: 24 }} />,
      color: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
      skills: [
        { name: 'React/Next.js', level: 95, experience: '5+ years' },
        { name: 'JavaScript/TypeScript', level: 90, experience: '4+ years' },
        { name: 'Tailwind CSS', level: 92, experience: '3+ years' },
        { name: 'Material-UI', level: 88, experience: '3+ years' },
        { name: 'Vue.js', level: 75, experience: '2+ years' }
      ]
    },
    {
      title: 'Backend Development',
      icon: <StorageIcon sx={{ fontSize: 24 }} />,
      color: 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)',
      skills: [
        { name: 'Node.js/Express', level: 85, experience: '4+ years' },
        { name: 'Python/Django', level: 80, experience: '3+ years' },
        { name: 'PostgreSQL', level: 82, experience: '3+ years' },
        { name: 'MongoDB', level: 78, experience: '2+ years' },
        { name: 'GraphQL', level: 70, experience: '2+ years' }
      ]
    },
    {
      title: 'DevOps & Tools',
      icon: <BuildIcon sx={{ fontSize: 24 }} />,
      color: 'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)',
      skills: [
        { name: 'Git/GitHub', level: 90, experience: '5+ years' },
        { name: 'Docker', level: 75, experience: '2+ years' },
        { name: 'AWS', level: 70, experience: '2+ years' },
        { name: 'Figma', level: 85, experience: '3+ years' },
        { name: 'Jest/Testing', level: 80, experience: '3+ years' }
      ]
    }
  ];

  const technologies = [
    { name: 'React', level: 'Expert', color: '#61dafb' },
    { name: 'JavaScript', level: 'Expert', color: '#f7df1e' },
    { name: 'Node.js', level: 'Advanced', color: '#68a063' },
    { name: 'Python', level: 'Advanced', color: '#3776ab' },
    { name: 'PostgreSQL', level: 'Advanced', color: '#336791' },
    { name: 'MongoDB', level: 'Intermediate', color: '#47a248' },
    { name: 'Tailwind CSS', level: 'Expert', color: '#06b6d4' },
    { name: 'Material-UI', level: 'Advanced', color: '#0081cb' },
    { name: 'Next.js', level: 'Advanced', color: '#000000' },
    { name: 'Express.js', level: 'Advanced', color: '#000000' },
    { name: 'Docker', level: 'Intermediate', color: '#2496ed' },
    { name: 'AWS', level: 'Intermediate', color: '#ff9900' },
    { name: 'Git', level: 'Expert', color: '#f05032' },
    { name: 'Figma', level: 'Advanced', color: '#f24e1e' },
    { name: 'Redux', level: 'Advanced', color: '#764abc' },
    { name: 'GraphQL', level: 'Intermediate', color: '#e10098' },
    { name: 'REST APIs', level: 'Expert', color: '#ff6b6b' },
    { name: 'Jest', level: 'Advanced', color: '#c21325' }
  ];

  return (
    <section 
      id="skills" 
      style={{
        background: 'linear-gradient(135deg, #0f0f23 0%, #1a1a2e 50%, #16213e 100%)',
        padding: '120px 0',
        position: 'relative',
        overflow: 'hidden'
      }}
    >
      {/* Background Pattern */}
      <div style={{
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: 'radial-gradient(circle at 20% 80%, rgba(120, 119, 198, 0.1) 0%, transparent 50%), radial-gradient(circle at 80% 20%, rgba(255, 119, 198, 0.1) 0%, transparent 50%)',
        pointerEvents: 'none'
      }} />
      
      <Container maxWidth="lg" style={{ position: 'relative', zIndex: 1 }}>
        {/* Header Section */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, type: "spring", stiffness: 100 }}
          viewport={{ once: true }}
          style={{ textAlign: 'center', marginBottom: '80px' }}
        >
          <motion.div
            initial={{ scale: 0.8 }}
            whileInView={{ scale: 1 }}
            transition={{ duration: 0.6, delay: 0.2 }}
            viewport={{ once: true }}
            style={{ marginBottom: '24px' }}
          >
            <Chip
              icon={<StarIcon />}
              label="Technical Expertise"
              sx={{
                background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                color: 'white',
                fontWeight: 600,
                fontSize: '14px',
                padding: '8px 16px',
                height: '40px',
                '& .MuiChip-icon': { color: 'white' }
              }}
            />
          </motion.div>
          
          <Typography 
            variant="h2" 
            sx={{ 
              fontSize: { xs: '2.5rem', md: '3.5rem' },
              fontWeight: 700,
              color: 'white',
              marginBottom: '24px',
              lineHeight: 1.2
            }}
          >
            My <span style={{ 
              background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              backgroundClip: 'text'
            }}>Skills</span>
          </Typography>
          
          <Typography 
            variant="body1" 
            sx={{ 
              color: '#a1a1aa',
              fontSize: '18px',
              maxWidth: '600px',
              margin: '0 auto',
              lineHeight: 1.6
            }}
          >
            Here are the technologies and tools I work with to bring ideas to life. 
            Each skill represents years of hands-on experience and continuous learning.
          </Typography>
        </motion.div>

        {/* Skills Categories */}
        <Grid container spacing={4} sx={{ marginBottom: '80px' }}>
          {skillCategories.map((category, categoryIndex) => (
            <Grid item xs={12} md={4} key={categoryIndex}>
              <motion.div
                initial={{ opacity: 0, y: 50 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ 
                  duration: 0.8, 
                  delay: categoryIndex * 0.2,
                  type: "spring",
                  stiffness: 100
                }}
                viewport={{ once: true }}
                whileHover={{ y: -8, scale: 1.02 }}
              >
                <Card 
                  sx={{
                    height: '100%',
                    background: 'rgba(255, 255, 255, 0.05)',
                    backdropFilter: 'blur(20px)',
                    border: '1px solid rgba(255, 255, 255, 0.1)',
                    borderRadius: '20px',
                    overflow: 'hidden',
                    position: 'relative',
                    transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                    '&:hover': {
                      boxShadow: '0 20px 40px rgba(0, 0, 0, 0.3)',
                      border: '1px solid rgba(255, 255, 255, 0.2)'
                    }
                  }}
                >
                  {/* Category Header */}
                  <Box sx={{
                    background: category.color,
                    padding: '24px',
                    textAlign: 'center',
                    position: 'relative'
                  }}>
                    <Avatar sx={{
                      width: 60,
                      height: 60,
                      margin: '0 auto 16px',
                      background: 'rgba(255, 255, 255, 0.2)',
                      backdropFilter: 'blur(10px)'
                    }}>
                      {category.icon}
                    </Avatar>
                    <Typography 
                      variant="h5" 
                      sx={{ 
                        color: 'white', 
                        fontWeight: 700,
                        fontSize: '20px'
                      }}
                    >
                      {category.title}
                    </Typography>
                  </Box>

                  <CardContent sx={{ padding: '24px' }}>
                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                      {category.skills.map((skill, skillIndex) => (
                        <motion.div
                          key={skillIndex}
                          initial={{ opacity: 0, x: -20 }}
                          whileInView={{ opacity: 1, x: 0 }}
                          transition={{ delay: skillIndex * 0.1 }}
                          viewport={{ once: true }}
                        >
                          <Box sx={{ marginBottom: 2 }}>
                            <Box sx={{ 
                              display: 'flex', 
                              justifyContent: 'space-between', 
                              alignItems: 'center',
                              marginBottom: 1
                            }}>
                              <Typography 
                                variant="body2" 
                                sx={{ 
                                  color: 'white',
                                  fontWeight: 600,
                                  fontSize: '14px'
                                }}
                              >
                                {skill.name}
                              </Typography>
                              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                <Typography 
                                  variant="body2" 
                                  sx={{ 
                                    color: '#a78bfa',
                                    fontWeight: 600,
                                    fontSize: '12px'
                                  }}
                                >
                                  {skill.experience}
                                </Typography>
                                <Chip
                                  label={`${skill.level}%`}
                                  size="small"
                                  sx={{
                                    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                                    color: 'white',
                                    fontWeight: 600,
                                    fontSize: '10px',
                                    height: '20px'
                                  }}
                                />
                              </Box>
                            </Box>
                            <LinearProgress
                              variant="determinate"
                              value={skill.level}
                              sx={{
                                height: 8,
                                borderRadius: 4,
                                backgroundColor: 'rgba(255, 255, 255, 0.1)',
                                '& .MuiLinearProgress-bar': {
                                  background: category.color,
                                  borderRadius: 4
                                }
                              }}
                            />
                          </Box>
                        </motion.div>
                      ))}
                    </Box>
                  </CardContent>
                </Card>
              </motion.div>
            </Grid>
          ))}
        </Grid>

        {/* Technologies Section */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, type: "spring", stiffness: 100 }}
          viewport={{ once: true }}
        >
          <Card 
            sx={{
              background: 'rgba(255, 255, 255, 0.05)',
              backdropFilter: 'blur(20px)',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              borderRadius: '24px',
              padding: '40px',
              textAlign: 'center'
            }}
          >
            <Box sx={{ marginBottom: '40px' }}>
              <Typography 
                variant="h4" 
                sx={{ 
                  color: 'white', 
                  fontWeight: 700,
                  fontSize: '28px',
                  marginBottom: '16px'
                }}
              >
                Technologies I Work With
              </Typography>
              <Typography 
                variant="body1" 
                sx={{ 
                  color: '#a1a1aa',
                  fontSize: '16px',
                  maxWidth: '500px',
                  margin: '0 auto'
                }}
              >
                A comprehensive toolkit for building modern, scalable applications
              </Typography>
            </Box>
            
            <Box sx={{ 
              display: 'flex', 
              flexWrap: 'wrap', 
              justifyContent: 'center', 
              gap: 2,
              maxWidth: '800px',
              margin: '0 auto'
            }}>
              {technologies.map((tech, index) => (
                <motion.div
                  key={index}
                  initial={{ opacity: 0, scale: 0.8 }}
                  whileInView={{ opacity: 1, scale: 1 }}
                  transition={{ 
                    duration: 0.5, 
                    delay: index * 0.05,
                    type: "spring",
                    stiffness: 200
                  }}
                  viewport={{ once: true }}
                  whileHover={{ 
                    scale: 1.1, 
                    y: -4,
                    transition: { duration: 0.2 }
                  }}
                >
                  <Chip
                    icon={
                      <Box sx={{
                        width: 8,
                        height: 8,
                        borderRadius: '50%',
                        backgroundColor: tech.color,
                        boxShadow: `0 0 10px ${tech.color}40`
                      }} />
                    }
                    label={tech.name}
                    sx={{
                      background: 'rgba(255, 255, 255, 0.1)',
                      color: 'white',
                      fontWeight: 500,
                      fontSize: '14px',
                      padding: '8px 16px',
                      height: '40px',
                      border: `1px solid ${tech.color}40`,
                      '&:hover': {
                        background: 'rgba(255, 255, 255, 0.15)',
                        transform: 'translateY(-2px)',
                        boxShadow: `0 8px 25px ${tech.color}30`
                      },
                      transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)'
                    }}
                  />
                </motion.div>
              ))}
            </Box>
          </Card>
        </motion.div>
      </Container>
    </section>
  );
};

export default Skills;
